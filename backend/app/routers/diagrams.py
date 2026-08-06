import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.ai_assist import draft_diagram_xml
from app.audit import log_action
from app.auth import require_role, require_user
from app.database import get_db
from app.models import DocumentDiagram, GeneratedDocument, Project, User
from app.routers.settings import get_ai_config
from app.schemas import DiagramAssistResponse, DiagramOut, DiagramSaveRequest, TemplateAssistRequest

router = APIRouter(prefix="/api/documents", tags=["diagrams"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "diagrams")
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


def to_out(d: DocumentDiagram | None) -> DiagramOut:
    if d is None:
        return DiagramOut(xml="", hasImage=False)
    return DiagramOut(xml=d.xml, hasImage=bool(d.png_path and os.path.isfile(d.png_path)))


def _get_document(db: Session, document_id: str) -> GeneratedDocument:
    doc = db.get(GeneratedDocument, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.get("/{document_id}/diagram", response_model=DiagramOut)
def get_diagram(document_id: str, db: Session = Depends(get_db), _user: str = Depends(require_user)):
    _get_document(db, document_id)
    return to_out(db.get(DocumentDiagram, document_id))


@router.put("/{document_id}/diagram", response_model=DiagramOut)
def save_diagram(
    document_id: str,
    payload: DiagramSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner", "Architect")),
):
    doc = _get_document(db, document_id)
    diagram = db.get(DocumentDiagram, document_id)
    if diagram is None:
        diagram = DocumentDiagram(document_id=document_id)
        db.add(diagram)
    diagram.xml = payload.xml
    diagram.updated_at = datetime.now(timezone.utc).isoformat()
    log_action(db, current_user.name, "Saved architecture diagram", doc.title)
    db.commit()
    db.refresh(diagram)
    return to_out(diagram)


@router.post("/{document_id}/diagram/assist", response_model=DiagramAssistResponse)
def assist_diagram(
    document_id: str,
    payload: TemplateAssistRequest,
    db: Session = Depends(get_db),
    _user: str = Depends(require_user),
):
    doc = _get_document(db, document_id)
    config = get_ai_config(db)
    project = db.query(Project).filter(Project.name == doc.project).first()
    cloud = project.cloud if project else "generic"
    try:
        xml = draft_diagram_xml(payload.instruction, cloud, config)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=f"AI request failed: {exc}") from exc
    return DiagramAssistResponse(xml=xml)


@router.post("/{document_id}/diagram/image", response_model=DiagramOut)
def upload_diagram_image(
    document_id: str,
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner", "Architect")),
):
    doc = _get_document(db, document_id)
    contents = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Diagram image exceeds 10 MB limit")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    stored_path = os.path.join(UPLOAD_DIR, f"{document_id}.png")
    with open(stored_path, "wb") as f:
        f.write(contents)

    diagram = db.get(DocumentDiagram, document_id)
    if diagram is None:
        diagram = DocumentDiagram(document_id=document_id, xml="")
        db.add(diagram)
    diagram.png_path = stored_path
    diagram.updated_at = datetime.now(timezone.utc).isoformat()
    log_action(db, current_user.name, "Exported architecture diagram image", doc.title)
    db.commit()
    db.refresh(diagram)
    return to_out(diagram)


@router.get("/{document_id}/diagram/image")
def get_diagram_image(document_id: str, db: Session = Depends(get_db), _user: str = Depends(require_user)):
    _get_document(db, document_id)
    diagram = db.get(DocumentDiagram, document_id)
    if not diagram or not diagram.png_path or not os.path.isfile(diagram.png_path):
        raise HTTPException(status_code=404, detail="No diagram image has been generated for this document yet")
    return FileResponse(diagram.png_path, media_type="image/png")
