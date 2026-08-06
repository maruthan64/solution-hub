from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.ai_assist import chat_reply, extract_project_from_chat
from app.auth import require_user
from app.database import get_db
from app.routers.settings import get_ai_config
from app.schemas import ChatRequest, ChatResponse, ProjectExtractionOut

router = APIRouter(prefix="/api/chat", tags=["chat"])

MAX_MESSAGES = 40


@router.post("", response_model=ChatResponse)
def chat(payload: ChatRequest, db: Session = Depends(get_db), _user: str = Depends(require_user)):
    if not payload.messages:
        raise HTTPException(status_code=400, detail="No messages provided")

    config = get_ai_config(db)

    messages = [{"role": m.role, "content": m.content} for m in payload.messages[-MAX_MESSAGES:]]
    try:
        reply = chat_reply(messages, config)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=f"AI request failed: {exc}") from exc

    return ChatResponse(reply=reply)


@router.post("/extract-project", response_model=ProjectExtractionOut)
def extract_project(payload: ChatRequest, db: Session = Depends(get_db), _user: str = Depends(require_user)):
    if not payload.messages:
        raise HTTPException(status_code=400, detail="No messages provided")

    config = get_ai_config(db)

    messages = [{"role": m.role, "content": m.content} for m in payload.messages[-MAX_MESSAGES:]]
    try:
        extracted = extract_project_from_chat(messages, config)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=f"AI request failed: {exc}") from exc

    return ProjectExtractionOut(**extracted)
