from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import require_user
from app.database import get_db
from app.models import AuditEntry
from app.schemas import AuditEntryOut

router = APIRouter(prefix="/api/audit-logs", tags=["audit-logs"])


@router.get("", response_model=list[AuditEntryOut])
def list_audit_log(db: Session = Depends(get_db), _user: str = Depends(require_user)):
    return db.query(AuditEntry).all()
