from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.audit import log_action
from app.auth import require_role, require_user
from app.database import get_db
from app.models import AppSettings, User
from app.schemas import ApiKeyUpdate, OrgSettingsUpdate, SettingsOut, SettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])

VALID_AI_PROVIDERS = {"litellm", "claude_cli"}


def get_or_create(db: Session) -> AppSettings:
    settings = db.get(AppSettings, "singleton")
    if not settings:
        settings = AppSettings(id="singleton", ai_provider="litellm")
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def mask_key(key: str | None) -> str | None:
    if not key:
        return None
    if len(key) <= 8:
        return "•" * len(key)
    return f"{key[:4]}{'•' * 6}{key[-4:]}"


def to_out(s: AppSettings) -> SettingsOut:
    return SettingsOut(
        aiProvider=s.ai_provider,
        orgName=s.org_name,
        defaultCloud=s.default_cloud,
        defaultExportFormat=s.default_export_format,
        apiKeyPreview=mask_key(s.litellm_proxy_key),
    )


@router.get("", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db), _user: str = Depends(require_user)):
    return to_out(get_or_create(db))


@router.put("", response_model=SettingsOut)
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db), _user: str = Depends(require_user)):
    if payload.aiProvider not in VALID_AI_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"aiProvider must be one of {sorted(VALID_AI_PROVIDERS)}")
    settings = get_or_create(db)
    settings.ai_provider = payload.aiProvider
    db.commit()
    db.refresh(settings)
    return to_out(settings)


@router.put("/organization", response_model=SettingsOut)
def update_organization(
    payload: OrgSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner")),
):
    settings = get_or_create(db)
    settings.org_name = payload.orgName
    settings.default_cloud = payload.defaultCloud
    settings.default_export_format = payload.defaultExportFormat
    log_action(db, current_user.name, "Updated organization settings", payload.orgName)
    db.commit()
    db.refresh(settings)
    return to_out(settings)


@router.post("/api-key", response_model=SettingsOut)
def rotate_api_key(
    payload: ApiKeyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner")),
):
    settings = get_or_create(db)
    settings.litellm_proxy_key = payload.apiKey
    log_action(db, current_user.name, "Rotated LiteLLM proxy key", mask_key(payload.apiKey) or "")
    db.commit()
    db.refresh(settings)
    return to_out(settings)
