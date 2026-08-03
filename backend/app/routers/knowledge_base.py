import os
import uuid
from datetime import date

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.audit import get_actor_name, log_action
from app.auth import require_user
from app.database import get_db
from app.models import KnowledgeDoc
from app.schemas import KnowledgeDocOut

router = APIRouter(prefix="/api/knowledge-base", tags=["knowledge-base"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "knowledge-base")
ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".md", ".txt"}
MAX_UPLOAD_BYTES = 20 * 1024 * 1024


def format_size(num_bytes: int) -> str:
    size = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024:
            return f"{size:.0f} {unit}" if unit == "B" else f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


def to_out(k: KnowledgeDoc) -> KnowledgeDocOut:
    return KnowledgeDocOut(
        id=k.id,
        name=k.name,
        category=k.category,
        uploadedBy=k.uploaded_by,
        uploaded=k.uploaded,
        size=k.size,
    )


@router.get("", response_model=list[KnowledgeDocOut])
def list_knowledge_docs(db: Session = Depends(get_db), _user: str = Depends(require_user)):
    return [to_out(k) for k in db.query(KnowledgeDoc).all()]


@router.post("", response_model=KnowledgeDocOut, status_code=201)
def upload_knowledge_doc(
    category: str = Form(...),
    file: UploadFile | None = None,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_user),
):
    if file is None or not file.filename:
        raise HTTPException(status_code=400, detail="A file is required.")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext or 'unknown'}")

    contents = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File exceeds 20 MB limit")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{ext}"
    stored_path = os.path.join(UPLOAD_DIR, stored_name)
    with open(stored_path, "wb") as f:
        f.write(contents)

    actor = get_actor_name(db, user_id)
    doc = KnowledgeDoc(
        id=f"kb-{uuid.uuid4().hex[:8]}",
        name=file.filename,
        category=category,
        uploaded_by=actor,
        uploaded=date.today().isoformat(),
        size=format_size(len(contents)),
        file_path=stored_path,
    )
    db.add(doc)
    log_action(db, actor, "Uploaded knowledge base file", file.filename)
    db.commit()
    db.refresh(doc)
    return to_out(doc)


@router.get("/{doc_id}/download")
def download_knowledge_doc(doc_id: str, db: Session = Depends(get_db), _user: str = Depends(require_user)):
    doc = db.get(KnowledgeDoc, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not doc.file_path or not os.path.isfile(doc.file_path):
        raise HTTPException(status_code=404, detail="File is no longer available on disk")
    return FileResponse(doc.file_path, filename=doc.name)


@router.delete("/{doc_id}")
def delete_knowledge_doc(doc_id: str, db: Session = Depends(get_db), user_id: str = Depends(require_user)):
    doc = db.get(KnowledgeDoc, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.file_path and os.path.isfile(doc.file_path):
        os.remove(doc.file_path)
    actor = get_actor_name(db, user_id)
    log_action(db, actor, "Deleted knowledge base file", doc.name)
    db.delete(doc)
    db.commit()
    return {"ok": True}
