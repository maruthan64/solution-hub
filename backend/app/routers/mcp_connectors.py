from fastapi import APIRouter, Depends, HTTPException

from app import mcp_cli
from app.auth import require_user
from app.schemas import (
    AddServerRequest,
    ConnectorOut,
    ReauthCompleteRequest,
    ReauthCompleteResponse,
    ReauthStartResponse,
)

router = APIRouter(prefix="/api/mcp", tags=["mcp"])


@router.get("/connectors", response_model=list[ConnectorOut])
def list_connectors(_user: str = Depends(require_user)):
    try:
        raw = mcp_cli.list_raw()
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return mcp_cli.parse_connectors(raw)


@router.post("/connectors/{name}/reauth/start", response_model=ReauthStartResponse)
def start_reauth(name: str, _user: str = Depends(require_user)):
    try:
        return mcp_cli.start_reauth(name)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/connectors/reauth/complete", response_model=ReauthCompleteResponse)
def complete_reauth(payload: ReauthCompleteRequest, _user: str = Depends(require_user)):
    try:
        return mcp_cli.complete_reauth(payload.sessionId, payload.redirectUrl)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/servers")
def add_server(payload: AddServerRequest, _user: str = Depends(require_user)):
    try:
        mcp_cli.add_server(payload.name, payload.transport, payload.commandOrUrl)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@router.get("/servers/{name}", response_model=AddServerRequest)
def get_server(name: str, _user: str = Depends(require_user)):
    try:
        return mcp_cli.get_server_detail(name)
    except RuntimeError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/servers/{name}")
def remove_server(name: str, _user: str = Depends(require_user)):
    try:
        mcp_cli.remove_server(name)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}
