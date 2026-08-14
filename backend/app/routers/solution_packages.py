import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.audit import get_actor_name, log_action
from app.auth import require_role, require_user
from app.database import get_db
from app.document_export import markdown_to_docx, markdown_to_pdf
from app.models import SolutionPackage, User
from app.schemas import SolutionPackageCreate, SolutionPackageOut, SolutionPackageUpdate

router = APIRouter(prefix="/api/solution-packages", tags=["solution-packages"])


def to_out(p: SolutionPackage) -> SolutionPackageOut:
    return SolutionPackageOut(
        id=p.id,
        name=p.name,
        cloud=p.cloud,
        tagline=p.tagline,
        outcome=p.outcome,
        assumptions=p.assumptions,
        services=p.services,
        referenceArchitecture=p.reference_architecture,
        pricingNote=p.pricing_note,
    )


def _build_solution_markdown(p: SolutionPackage) -> str:
    lines = [f"# {p.name}", ""]
    if p.tagline:
        lines.append(f"*{p.tagline}*")
        lines.append("")
    lines.append(f"**Cloud:** {p.cloud}")
    lines.append("")
    if p.outcome:
        lines.append("## Outcome")
        lines.append(p.outcome)
        lines.append("")
    if p.services:
        lines.append("## Services")
        for s in p.services:
            lines.append(f"- **{s['service']}:** {s['purpose']}")
        lines.append("")
    if p.reference_architecture:
        lines.append("## Reference Architecture")
        lines.append(p.reference_architecture)
        lines.append("")
    if p.assumptions:
        lines.append("## Assumptions")
        for a in p.assumptions:
            lines.append(f"- {a}")
        lines.append("")
    if p.pricing_note:
        lines.append("## Pricing")
        lines.append(p.pricing_note)
        lines.append("")
    return "\n".join(lines)


@router.get("", response_model=list[SolutionPackageOut])
def list_solution_packages(db: Session = Depends(get_db), _user: str = Depends(require_user)):
    return [to_out(p) for p in db.query(SolutionPackage).all()]


@router.get("/{package_id}", response_model=SolutionPackageOut)
def get_solution_package(package_id: str, db: Session = Depends(get_db), _user: str = Depends(require_user)):
    package = db.get(SolutionPackage, package_id)
    if not package:
        raise HTTPException(status_code=404, detail="Solution package not found")
    return to_out(package)


@router.get("/{package_id}/export")
def export_solution_package(
    package_id: str, format: str = "docx", db: Session = Depends(get_db), user_id: str = Depends(require_user)
):
    if format not in ("docx", "pdf"):
        raise HTTPException(status_code=400, detail="format must be 'docx' or 'pdf'")

    package = db.get(SolutionPackage, package_id)
    if not package:
        raise HTTPException(status_code=404, detail="Solution package not found")

    markdown_text = _build_solution_markdown(package)
    actor = get_actor_name(db, user_id)
    log_action(db, actor, "Exported solution package", f"{package.name} ({format})")
    db.commit()

    filename = package.name.replace(" ", "_")
    if format == "pdf":
        return Response(
            content=markdown_to_pdf(package.name, markdown_text),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'},
        )

    return Response(
        content=markdown_to_docx(package.name, markdown_text),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}.docx"'},
    )


@router.post("", response_model=SolutionPackageOut, status_code=201)
def create_solution_package(
    payload: SolutionPackageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner", "Architect")),
):
    package = SolutionPackage(
        id=f"sol-{uuid.uuid4().hex[:8]}",
        name=payload.name,
        cloud=payload.cloud,
        tagline=payload.tagline,
        outcome=payload.outcome,
        assumptions=payload.assumptions,
        services=[s.model_dump() for s in payload.services],
        reference_architecture=payload.referenceArchitecture,
        pricing_note=payload.pricingNote,
    )
    db.add(package)
    log_action(db, current_user.name, "Added solution package", payload.name)
    db.commit()
    db.refresh(package)
    return to_out(package)


@router.put("/{package_id}", response_model=SolutionPackageOut)
def update_solution_package(
    package_id: str,
    payload: SolutionPackageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner", "Architect")),
):
    package = db.get(SolutionPackage, package_id)
    if not package:
        raise HTTPException(status_code=404, detail="Solution package not found")

    package.name = payload.name
    package.cloud = payload.cloud
    package.tagline = payload.tagline
    package.outcome = payload.outcome
    package.assumptions = payload.assumptions
    package.services = [s.model_dump() for s in payload.services]
    package.reference_architecture = payload.referenceArchitecture
    package.pricing_note = payload.pricingNote
    log_action(db, current_user.name, "Updated solution package", package.name)
    db.commit()
    db.refresh(package)
    return to_out(package)


@router.delete("/{package_id}")
def delete_solution_package(
    package_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner", "Architect")),
):
    package = db.get(SolutionPackage, package_id)
    if not package:
        raise HTTPException(status_code=404, detail="Solution package not found")

    name = package.name
    db.delete(package)
    log_action(db, current_user.name, "Deleted solution package", name)
    db.commit()
    return {"ok": True}
