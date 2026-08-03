import os
import uuid
from datetime import date

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.ai_assist import draft_content
from app.audit import log_action
from app.auth import require_role, require_user
from app.database import get_db
from app.models import AppSettings, Capability, DocTemplate, GeneratedDocument, Project, User
from app.schemas import ProjectOut

router = APIRouter(prefix="/api/projects", tags=["projects"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".md", ".txt"}
MAX_UPLOAD_BYTES = 20 * 1024 * 1024

DOC_TYPE_KEYWORDS = [
    ("Solution Design", "SDD"),
    ("Architecture Decision", "ADR"),
    ("Bill of Materials", "BOM"),
    ("Cost", "Cost Estimate"),
    ("Security", "Security Review"),
    ("Runbook", "Runbook"),
    ("Handover", "Handover"),
]


def infer_doc_type(template_name: str) -> str:
    for keyword, doc_type in DOC_TYPE_KEYWORDS:
        if keyword.lower() in template_name.lower():
            return doc_type
    return "SDD"


def to_out(p: Project, db: Session) -> ProjectOut:
    capability_name = None
    if p.capability_id:
        capability = db.get(Capability, p.capability_id)
        capability_name = capability.name if capability else None
    return ProjectOut(
        id=p.id,
        name=p.name,
        customer=p.customer,
        cloud=p.cloud,
        status=p.status,
        owner=p.owner,
        updated=p.updated,
        docsGenerated=p.docs_generated,
        description=p.description,
        sourceDocument=p.source_document,
        capabilityId=p.capability_id,
        capabilityName=capability_name,
    )


@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db), _user: str = Depends(require_user)):
    return [to_out(p, db) for p in db.query(Project).all()]


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, db: Session = Depends(get_db), _user: str = Depends(require_user)):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return to_out(p, db)


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(
    name: str = Form(...),
    customer: str = Form(...),
    cloud: str = Form(...),
    description: str = Form(""),
    templateId: str | None = Form(None),
    capabilityId: str | None = Form(None),
    document: UploadFile | None = None,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_user),
):
    owner = db.get(User, user_id)
    owner_name = owner.name if owner else "admin"

    if capabilityId and not db.get(Capability, capabilityId):
        raise HTTPException(status_code=404, detail="Capability not found")

    source_document = None
    if document is not None and document.filename:
        ext = os.path.splitext(document.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext or 'unknown'}")

        contents = document.file.read(MAX_UPLOAD_BYTES + 1)
        if len(contents) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=400, detail="File exceeds 20 MB limit")

        os.makedirs(UPLOAD_DIR, exist_ok=True)
        stored_name = f"{uuid.uuid4().hex}{ext}"
        with open(os.path.join(UPLOAD_DIR, stored_name), "wb") as f:
            f.write(contents)
        source_document = document.filename

    template = None
    generated_content = None
    if templateId:
        template = db.get(DocTemplate, templateId)
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

        instruction = f"Fill in this template for a project called '{name}', for customer '{customer}', on {cloud}."
        if description:
            instruction += f" Project description: {description}"

        settings = db.get(AppSettings, "singleton")
        provider = settings.ai_provider if settings else "litellm"
        try:
            generated_content = draft_content(template.content, instruction, provider)
        except RuntimeError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Project not created — AI document generation failed: {exc}",
            ) from exc

    project = Project(
        id=f"prj-{uuid.uuid4().hex[:8]}",
        name=name,
        customer=customer,
        cloud=cloud,
        status="Draft",
        owner=owner_name,
        updated=date.today().isoformat(),
        docs_generated=1 if template else 0,
        description=description,
        source_document=source_document,
        capability_id=capabilityId,
    )
    db.add(project)

    if template:
        doc = GeneratedDocument(
            id=f"doc-{uuid.uuid4().hex[:8]}",
            project=name,
            type=infer_doc_type(template.name),
            title=template.name,
            version="v1.0",
            updated=date.today().isoformat(),
            status="Draft",
            content=generated_content,
        )
        db.add(doc)
        log_action(db, owner_name, "Generated document from template (AI)", f"{template.name} → {name}")

    log_action(db, owner_name, "Created project", name)
    db.commit()
    db.refresh(project)
    return to_out(project, db)


@router.delete("/{project_id}")
def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner", "Architect")),
):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    name = p.name
    # GeneratedDocument references projects by name, not a foreign key, so it
    # needs an explicit cleanup pass rather than a cascade.
    db.query(GeneratedDocument).filter(GeneratedDocument.project == name).delete()
    db.delete(p)
    log_action(db, current_user.name, "Deleted project", name)
    db.commit()
    return {"ok": True}
