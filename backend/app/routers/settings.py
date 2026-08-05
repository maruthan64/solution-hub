import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.audit import log_action
from app.auth import require_role, require_user
from app.database import get_db
from app.models import AppSettings, User
from app.schemas import ApiKeyUpdate, BedrockCredentialsUpdate, OrgSettingsUpdate, SettingsOut, SettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])

VALID_AI_PROVIDERS = {"litellm", "claude_cli", "bedrock"}


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
        bedrockAccessKeyIdPreview=mask_key(s.bedrock_access_key_id),
        bedrockSecretKeySet=bool(s.bedrock_secret_access_key),
        bedrockRegion=s.bedrock_region,
        bedrockModel=s.bedrock_model,
    )


def apply_bedrock_env(s: AppSettings) -> None:
    """Bridges DB-stored Bedrock credentials into process env vars, since that's what
    litellm/boto3 actually read for bedrock/ model calls — called on save (immediate
    effect) and again at backend startup (main.py) so a restart doesn't silently drop
    previously-saved credentials. Only sets what's actually stored, never clears a var
    that e.g. backend/.env or an IAM role is already providing."""
    if s.bedrock_access_key_id:
        os.environ["AWS_ACCESS_KEY_ID"] = s.bedrock_access_key_id
    if s.bedrock_secret_access_key:
        os.environ["AWS_SECRET_ACCESS_KEY"] = s.bedrock_secret_access_key
    if s.bedrock_region:
        os.environ["AWS_REGION_NAME"] = s.bedrock_region  # what litellm's bedrock provider reads
        os.environ["AWS_DEFAULT_REGION"] = s.bedrock_region  # boto3's own standard fallback
    if s.bedrock_model:
        os.environ["BEDROCK_MODEL"] = s.bedrock_model


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


@router.post("/bedrock", response_model=SettingsOut)
def update_bedrock_credentials(
    payload: BedrockCredentialsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner")),
):
    settings = get_or_create(db)
    # Access key / secret are rotate-only: a blank submission keeps the existing stored
    # value rather than clearing it (matches the LiteLLM key's "leave blank to keep" UX).
    # Region/model are plain fields — an explicit empty string does clear them.
    if payload.accessKeyId:
        settings.bedrock_access_key_id = payload.accessKeyId
    if payload.secretAccessKey:
        settings.bedrock_secret_access_key = payload.secretAccessKey
    if payload.region is not None:
        settings.bedrock_region = payload.region or None
    if payload.model is not None:
        settings.bedrock_model = payload.model or None
    log_action(db, current_user.name, "Updated AWS Bedrock credentials", "-")
    db.commit()
    db.refresh(settings)
    apply_bedrock_env(settings)
    return to_out(settings)
