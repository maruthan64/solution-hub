import re
import uuid

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.ai_assist import draft_content
from app.audit import log_action
from app.auth import require_role, require_user
from app.database import get_db
from app.document_export import markdown_to_docx, markdown_to_pdf
from app.document_extract import extract_text
from app.models import DocTemplate, User
from app.routers.settings import get_ai_config
from app.schemas import TemplateAssistRequest, TemplateAssistResponse, TemplateOut, TemplateSource, TemplateUpdate

router = APIRouter(prefix="/api/templates", tags=["templates"])

MAX_UPLOAD_BYTES = 20 * 1024 * 1024


def to_out(t: DocTemplate) -> TemplateOut:
    source = TemplateSource(label=t.source_label, url=t.source_url) if t.source_label and t.source_url else None
    return TemplateOut(
        id=t.id,
        name=t.name,
        cloud=t.cloud,
        sections=t.sections,
        description=t.description,
        source=source,
        content=t.content,
    )


def count_sections(content: str) -> int:
    return max(1, sum(1 for line in content.splitlines() if line.startswith("## ")))


@router.get("", response_model=list[TemplateOut])
def list_templates(db: Session = Depends(get_db), _user: str = Depends(require_user)):
    return [to_out(t) for t in db.query(DocTemplate).all()]


@router.get("/{template_id}", response_model=TemplateOut)
def get_template(template_id: str, db: Session = Depends(get_db), _user: str = Depends(require_user)):
    t = db.get(DocTemplate, template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return to_out(t)


@router.post("", response_model=TemplateOut, status_code=201)
def create_template(
    name: str = Form(...),
    cloud: str = Form(...),
    description: str = Form(""),
    document: UploadFile | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner", "Architect")),
):
    content = f"# {name}\n\n"
    if document is not None and document.filename:
        raw = document.file.read(MAX_UPLOAD_BYTES + 1)
        if len(raw) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=400, detail="File exceeds 20 MB limit")
        try:
            content = extract_text(document.filename, raw)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:  # noqa: BLE001 - a malformed upload must never 500, always a clean 400
            raise HTTPException(
                status_code=400,
                detail=(
                    "Couldn't read that file. If it's an older .doc file, re-save it as .docx and try "
                    "again, or leave the upload empty to start from a blank template."
                ),
            ) from exc
        if not content.strip():
            raise HTTPException(status_code=400, detail="Couldn't extract any text from that file.")

    template = DocTemplate(
        id=f"tpl-{uuid.uuid4().hex[:8]}",
        name=name,
        cloud=cloud,
        sections=count_sections(content),
        description=description or "Custom template.",
        content=content,
    )
    db.add(template)
    log_action(db, current_user.name, "Created template", name)
    db.commit()
    db.refresh(template)
    return to_out(template)


@router.put("/{template_id}", response_model=TemplateOut)
def update_template(
    template_id: str,
    payload: TemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner", "Architect")),
):
    t = db.get(DocTemplate, template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    t.content = payload.content
    t.sections = count_sections(payload.content)
    log_action(db, current_user.name, "Updated template", t.name)
    db.commit()
    db.refresh(t)
    return to_out(t)


@router.get("/{template_id}/export")
def export_template(
    template_id: str, format: str = "docx", db: Session = Depends(get_db), _user: str = Depends(require_user)
):
    t = db.get(DocTemplate, template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")

    slug = re.sub(r"[^A-Za-z0-9_-]+", "_", t.name).strip("_")
    if format == "pdf":
        pdf_bytes = markdown_to_pdf(t.name, t.content)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{slug}.pdf"'},
        )

    docx_bytes = markdown_to_docx(t.name, t.content)
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{slug}.docx"'},
    )


@router.post("/{template_id}/assist", response_model=TemplateAssistResponse)
def assist_template(
    template_id: str,
    payload: TemplateAssistRequest,
    db: Session = Depends(get_db),
    _user: str = Depends(require_user),
):
    t = db.get(DocTemplate, template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    config = get_ai_config(db)
    try:
        suggestion = draft_content(t.content, payload.instruction, config)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=f"AI request failed: {exc}") from exc
    return TemplateAssistResponse(suggestion=suggestion)
