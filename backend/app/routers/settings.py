from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.ai_assist import AiConfig
from app.ai_assist import test_connection as run_connection_test
from app.audit import log_action
from app.auth import require_role, require_user
from app.database import get_db
from app.models import AppSettings, User
from app.schemas import (
    BedrockCredentialsUpdate,
    OrgSettingsUpdate,
    SettingsOut,
    SettingsUpdate,
    TestConnectionRequest,
    TestConnectionResult,
)

router = APIRouter(prefix="/api/settings", tags=["settings"])

VALID_AI_PROVIDERS = {"claude_cli", "bedrock"}


def get_or_create(db: Session) -> AppSettings:
    settings = db.get(AppSettings, "singleton")
    if not settings:
        settings = AppSettings(id="singleton", ai_provider="claude_cli")
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
        bedrockApiKeyPreview=mask_key(s.bedrock_api_key),
        bedrockRegion=s.bedrock_region,
        bedrockModel=s.bedrock_model,
    )


def get_ai_config(db: Session) -> AiConfig:
    """Shared by every router that calls into ai_assist — builds the provider config fresh
    from the settings row on each request rather than caching it anywhere."""
    return AiConfig.from_settings(db.get(AppSettings, "singleton"))


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


@router.post("/bedrock", response_model=SettingsOut)
def update_bedrock_credentials(
    payload: BedrockCredentialsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner")),
):
    settings = get_or_create(db)
    # API key is rotate-only: a blank submission keeps the existing stored value rather
    # than clearing it. Region/model are plain fields — an explicit empty string does
    # clear them.
    if payload.apiKey:
        settings.bedrock_api_key = payload.apiKey
    if payload.region is not None:
        settings.bedrock_region = payload.region or None
    if payload.model is not None:
        settings.bedrock_model = payload.model or None
    log_action(db, current_user.name, "Updated AWS Bedrock credentials", "-")
    db.commit()
    db.refresh(settings)
    return to_out(settings)


@router.post("/test-connection", response_model=TestConnectionResult)
def test_connection(
    payload: TestConnectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner")),
):
    if payload.provider not in VALID_AI_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"provider must be one of {sorted(VALID_AI_PROVIDERS)}")
    settings = get_or_create(db)
    config = AiConfig.from_settings(settings)
    config.provider = payload.provider  # test whichever provider was picked, even if unsaved
    try:
        reply = run_connection_test(config)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    log_action(db, current_user.name, "Tested AI provider connection", payload.provider)
    return TestConnectionResult(ok=True, reply=reply)
