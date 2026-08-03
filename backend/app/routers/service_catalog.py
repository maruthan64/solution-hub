from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.audit import get_actor_name, log_action
from app.auth import require_role, require_user
from app.database import get_db
from app.document_export import build_quote_docx, build_quote_pdf, build_quote_proposal_pdf
from app.models import ServicePackage, User
from app.schemas import QuoteRequest, ResourceLine, ServicePackageOut, ServicePackageUpdate

router = APIRouter(prefix="/api/service-catalog", tags=["service-catalog"])


def to_out(p: ServicePackage) -> ServicePackageOut:
    return ServicePackageOut(
        id=p.id,
        category=p.category,
        name=p.name,
        tagline=p.tagline,
        monthlyPrice=p.monthly_price,
        resources=[ResourceLine(**r) for r in p.resources],
    )


@router.get("", response_model=list[ServicePackageOut])
def list_packages(db: Session = Depends(get_db), _user: str = Depends(require_user)):
    return [to_out(p) for p in db.query(ServicePackage).all()]


@router.get("/{package_id}", response_model=ServicePackageOut)
def get_package(package_id: str, db: Session = Depends(get_db), _user: str = Depends(require_user)):
    p = db.get(ServicePackage, package_id)
    if not p:
        raise HTTPException(status_code=404, detail="Package not found")
    return to_out(p)


@router.put("/{package_id}", response_model=ServicePackageOut)
def update_package(
    package_id: str,
    payload: ServicePackageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner", "Architect")),
):
    p = db.get(ServicePackage, package_id)
    if not p:
        raise HTTPException(status_code=404, detail="Package not found")
    p.name = payload.name
    p.tagline = payload.tagline
    p.monthly_price = payload.monthlyPrice
    p.resources = [r.model_dump() for r in payload.resources]
    log_action(db, current_user.name, "Updated service package", p.name)
    db.commit()
    db.refresh(p)
    return to_out(p)


@router.post("/quote")
def generate_quote(payload: QuoteRequest, db: Session = Depends(get_db), user_id: str = Depends(require_user)):
    if not payload.packageIds:
        raise HTTPException(status_code=400, detail="Select at least one package for the quote.")
    if payload.format not in ("docx", "pdf", "proposal"):
        raise HTTPException(status_code=400, detail="format must be 'docx', 'pdf', or 'proposal'")

    packages = db.query(ServicePackage).filter(ServicePackage.id.in_(payload.packageIds)).all()
    found_ids = {p.id for p in packages}
    missing = set(payload.packageIds) - found_ids
    if missing:
        raise HTTPException(status_code=404, detail=f"Unknown package id(s): {', '.join(sorted(missing))}")

    # Preserve the order the caller selected them in, not DB order.
    by_id = {p.id: p for p in packages}
    ordered = [by_id[pid] for pid in payload.packageIds]
    quote_packages = [
        {"id": p.id, "name": p.name, "tagline": p.tagline, "monthlyPrice": p.monthly_price, "resources": p.resources}
        for p in ordered
    ]

    safe_customer = "".join(c if c.isalnum() else "_" for c in (payload.customerName or "Customer")).strip("_")

    actor = get_actor_name(db, user_id)
    log_action(db, actor, f"Generated {payload.format} quote", payload.customerName)

    if payload.format == "proposal":
        return Response(
            content=build_quote_proposal_pdf(payload.customerName, payload.description, quote_packages),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="Proposal_{safe_customer}.pdf"'},
        )

    if payload.format == "pdf":
        return Response(
            content=build_quote_pdf(payload.customerName, payload.description, quote_packages),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="Quote_{safe_customer}.pdf"'},
        )

    return Response(
        content=build_quote_docx(payload.customerName, payload.description, quote_packages),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="Quote_{safe_customer}.docx"'},
    )
