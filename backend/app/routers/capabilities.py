import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.audit import get_actor_name, log_action
from app.auth import require_role, require_user
from app.database import get_db
from app.document_export import markdown_to_docx, markdown_to_pdf
from app.models import Capability, User
from app.schemas import CapabilityCreate, CapabilityOut, CapabilityUpdate, CaseStudy

router = APIRouter(prefix="/api/capabilities", tags=["capabilities"])


def to_out(c: Capability) -> CapabilityOut:
    return CapabilityOut(
        id=c.id,
        name=c.name,
        cloud=c.cloud,
        description=c.description,
        keyServices=c.key_services,
        status=c.status,
        githubUrl=c.github_url,
        certifications=c.certifications,
        caseStudies=[CaseStudy(**cs) for cs in c.case_studies],
    )


@router.get("", response_model=list[CapabilityOut])
def list_capabilities(db: Session = Depends(get_db), _user: str = Depends(require_user)):
    return [to_out(c) for c in db.query(Capability).all()]


def _build_matrix_markdown(capabilities: list[Capability]) -> str:
    lines = ["# Capability Matrix", ""]
    for c in capabilities:
        lines.append(f"## {c.name} ({c.cloud}) — {c.status}")
        lines.append("")
        if c.description:
            lines.append(c.description)
            lines.append("")
        if c.key_services:
            lines.append(f"**Key Services:** {', '.join(c.key_services)}")
            lines.append("")
        if c.certifications:
            lines.append(f"**Certifications:** {', '.join(c.certifications)}")
            lines.append("")
        if c.case_studies:
            lines.append("**Case Studies:**")
            for cs in c.case_studies:
                lines.append(f"- **{cs['customer']}:** {cs['outcome']}")
            lines.append("")
        if c.github_url:
            lines.append(f"**Reference:** {c.github_url}")
            lines.append("")
    return "\n".join(lines)


@router.get("/export")
def export_capabilities(format: str = "docx", db: Session = Depends(get_db), user_id: str = Depends(require_user)):
    if format not in ("docx", "pdf"):
        raise HTTPException(status_code=400, detail="format must be 'docx' or 'pdf'")

    capabilities = db.query(Capability).all()
    markdown_text = _build_matrix_markdown(capabilities)
    actor = get_actor_name(db, user_id)
    log_action(db, actor, "Exported capability matrix", f"{len(capabilities)} capabilities ({format})")
    db.commit()

    if format == "pdf":
        return Response(
            content=markdown_to_pdf("Capability Matrix", markdown_text),
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="Capability_Matrix.pdf"'},
        )

    return Response(
        content=markdown_to_docx("Capability Matrix", markdown_text),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": 'attachment; filename="Capability_Matrix.docx"'},
    )


@router.post("", response_model=CapabilityOut, status_code=201)
def create_capability(
    payload: CapabilityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner", "Architect")),
):
    capability = Capability(
        id=f"cap-{uuid.uuid4().hex[:8]}",
        name=payload.name,
        cloud=payload.cloud,
        description=payload.description,
        key_services=payload.keyServices,
        status=payload.status,
        github_url=payload.githubUrl,
        certifications=payload.certifications,
        case_studies=[cs.model_dump() for cs in payload.caseStudies],
    )
    db.add(capability)
    log_action(db, current_user.name, "Added capability", payload.name)
    db.commit()
    db.refresh(capability)
    return to_out(capability)


@router.put("/{capability_id}", response_model=CapabilityOut)
def update_capability(
    capability_id: str,
    payload: CapabilityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner", "Architect")),
):
    capability = db.get(Capability, capability_id)
    if not capability:
        raise HTTPException(status_code=404, detail="Capability not found")

    capability.name = payload.name
    capability.cloud = payload.cloud
    capability.description = payload.description
    capability.key_services = payload.keyServices
    capability.status = payload.status
    capability.github_url = payload.githubUrl
    capability.certifications = payload.certifications
    capability.case_studies = [cs.model_dump() for cs in payload.caseStudies]
    log_action(db, current_user.name, "Updated capability", capability.name)
    db.commit()
    db.refresh(capability)
    return to_out(capability)


@router.delete("/{capability_id}")
def delete_capability(
    capability_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner", "Architect")),
):
    capability = db.get(Capability, capability_id)
    if not capability:
        raise HTTPException(status_code=404, detail="Capability not found")

    name = capability.name
    db.delete(capability)
    log_action(db, current_user.name, "Deleted capability", name)
    db.commit()
    return {"ok": True}
