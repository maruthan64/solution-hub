import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import AuditEntry, User


def get_actor_name(db: Session, user_id: str) -> str:
    user = db.get(User, user_id)
    return user.name if user else user_id


def log_action(db: Session, actor: str, action: str, target: str) -> None:
    entry = AuditEntry(
        id=f"a-{uuid.uuid4().hex[:8]}",
        actor=actor,
        action=action,
        target=target,
        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M"),
    )
    db.add(entry)
    db.commit()
