import os
import re

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.ai_assist import draft_content
from app.audit import log_action
from app.auth import require_role, require_user
from app.database import get_db
from app.document_export import markdown_to_docx, markdown_to_pdf
from app.models import DocumentDiagram, GeneratedDocument, User
from app.routers.settings import get_ai_config
from app.schemas import DocumentOut, ReviewNoteRequest, TemplateAssistRequest, TemplateAssistResponse, TemplateUpdate

router = APIRouter(prefix="/api/documents", tags=["documents"])

STATUS_DRAFT = "Draft"
STATUS_IN_REVIEW = "In Review"
STATUS_APPROVED = "Approved"

DIAGRAM_IMAGE_URL_PATTERN = re.compile(r"^/api/documents/([^/]+)/diagram/image$")


def _resolve_diagram_image(db: Session):
    """Bridge an embedded `![...](/api/documents/{id}/diagram/image)` markdown line to real
    bytes for export — same process, so this reads straight off disk rather than over HTTP."""

    def resolver(url: str) -> bytes | None:
        match = DIAGRAM_IMAGE_URL_PATTERN.match(url)
        if not match:
            return None
        diagram = db.get(DocumentDiagram, match.group(1))
        if not diagram or not diagram.png_path or not os.path.isfile(diagram.png_path):
            return None
        with open(diagram.png_path, "rb") as f:
            return f.read()

    return resolver


@router.get("", response_model=list[DocumentOut])
def list_documents(db: Session = Depends(get_db), _user: str = Depends(require_user)):
    return db.query(GeneratedDocument).all()


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(document_id: str, db: Session = Depends(get_db), _user: str = Depends(require_user)):
    doc = db.get(GeneratedDocument, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.put("/{document_id}", response_model=DocumentOut)
def update_document(
    document_id: str,
    payload: TemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner", "Architect")),
):
    doc = db.get(GeneratedDocument, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    content_changed = payload.content != doc.content
    doc.content = payload.content
    if content_changed and doc.status != STATUS_DRAFT:
        doc.status = STATUS_DRAFT
        doc.review_note = None
        log_action(db, current_user.name, "Edited document — review reset to Draft", doc.title)
    else:
        log_action(db, current_user.name, "Updated document", doc.title)
    db.commit()
    db.refresh(doc)
    return doc


@router.post("/{document_id}/submit-review", response_model=DocumentOut)
def submit_for_review(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner", "Architect")),
):
    doc = db.get(GeneratedDocument, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.status != STATUS_DRAFT:
        raise HTTPException(status_code=400, detail=f"Only Draft documents can be submitted for review (current: {doc.status})")

    doc.status = STATUS_IN_REVIEW
    doc.review_note = None
    log_action(db, current_user.name, "Submitted document for review", doc.title)
    db.commit()
    db.refresh(doc)
    return doc


@router.post("/{document_id}/approve", response_model=DocumentOut)
def approve_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner", "Reviewer")),
):
    doc = db.get(GeneratedDocument, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.status != STATUS_IN_REVIEW:
        raise HTTPException(status_code=400, detail=f"Only documents In Review can be approved (current: {doc.status})")

    doc.status = STATUS_APPROVED
    doc.review_note = None
    log_action(db, current_user.name, "Approved document", doc.title)
    db.commit()
    db.refresh(doc)
    return doc


@router.post("/{document_id}/request-changes", response_model=DocumentOut)
def request_changes(
    document_id: str,
    payload: ReviewNoteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner", "Reviewer")),
):
    doc = db.get(GeneratedDocument, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.status != STATUS_IN_REVIEW:
        raise HTTPException(status_code=400, detail=f"Only documents In Review can have changes requested (current: {doc.status})")
    if not payload.note.strip():
        raise HTTPException(status_code=400, detail="A note explaining the requested changes is required")

    doc.status = STATUS_DRAFT
    doc.review_note = payload.note.strip()
    log_action(db, current_user.name, "Requested changes on document", doc.title)
    db.commit()
    db.refresh(doc)
    return doc


@router.post("/{document_id}/assist", response_model=TemplateAssistResponse)
def assist_document(
    document_id: str,
    payload: TemplateAssistRequest,
    db: Session = Depends(get_db),
    _user: str = Depends(require_user),
):
    doc = db.get(GeneratedDocument, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    config = get_ai_config(db)
    try:
        suggestion = draft_content(doc.content, payload.instruction, config)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=f"AI request failed: {exc}") from exc
    return TemplateAssistResponse(suggestion=suggestion)


@router.get("/{document_id}/export")
def export_document(
    document_id: str,
    format: str = "docx",
    db: Session = Depends(get_db),
    _user: str = Depends(require_user),
):
    doc = db.get(GeneratedDocument, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if format not in ("docx", "pdf"):
        raise HTTPException(status_code=400, detail="format must be 'docx' or 'pdf'")

    safe_name = re.sub(r"[^A-Za-z0-9_-]+", "_", doc.title).strip("_")
    resolve_image = _resolve_diagram_image(db)

    if format == "pdf":
        return Response(
            content=markdown_to_pdf(doc.title, doc.content, resolve_image=resolve_image),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.pdf"'},
        )

    return Response(
        content=markdown_to_docx(doc.title, doc.content, resolve_image=resolve_image),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.docx"'},
    )
