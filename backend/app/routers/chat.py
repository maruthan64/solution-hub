from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.ai_assist import chat_reply
from app.auth import require_user
from app.database import get_db
from app.models import AppSettings
from app.schemas import ChatRequest, ChatResponse

router = APIRouter(prefix="/api/chat", tags=["chat"])

MAX_MESSAGES = 40


@router.post("", response_model=ChatResponse)
def chat(payload: ChatRequest, db: Session = Depends(get_db), _user: str = Depends(require_user)):
    if not payload.messages:
        raise HTTPException(status_code=400, detail="No messages provided")

    settings = db.get(AppSettings, "singleton")
    provider = settings.ai_provider if settings else "litellm"

    messages = [{"role": m.role, "content": m.content} for m in payload.messages[-MAX_MESSAGES:]]
    try:
        reply = chat_reply(messages, provider)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=f"AI request failed: {exc}") from exc

    return ChatResponse(reply=reply)
