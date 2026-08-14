from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.audit import log_action
from app.auth import require_role
from app.database import get_db
from app.models import RolePermission, User
from app.schemas import CreateRolePermissionRequest, RolePermissionOut, UpdateRolePermissionRequest

router = APIRouter(prefix="/api/role-permissions", tags=["role-permissions"])

# Every sidebar/nav key that can be granted to a role — must stay in sync with
# frontend/lib/nav.ts. Kept here (not imported) since the frontend is a separate app.
ALL_MODULES = [
    "/",
    "/projects",
    "/capabilities",
    "/solution-packages",
    "/service-catalog",
    "/chat",
    "/documents",
    "/knowledge-base",
    "/templates",
    "/connectors",
    "/users",
    "/audit-logs",
    "/settings",
]

BUILT_IN_ROLES = {"Owner", "Architect", "Reviewer", "Viewer"}


def to_out(rp: RolePermission) -> RolePermissionOut:
    return RolePermissionOut(role=rp.role, allowedModules=rp.allowed_modules, builtIn=rp.role in BUILT_IN_ROLES)


def _validate_modules(modules: list[str]) -> None:
    unknown = [m for m in modules if m not in ALL_MODULES]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown module(s): {', '.join(unknown)}")


@router.get("", response_model=list[RolePermissionOut])
def list_role_permissions(db: Session = Depends(get_db), _user: User = Depends(require_role("Owner"))):
    return [to_out(rp) for rp in db.query(RolePermission).all()]


@router.post("", response_model=RolePermissionOut, status_code=201)
def create_role_permission(
    payload: CreateRolePermissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner")),
):
    role = payload.role.strip()
    if not role:
        raise HTTPException(status_code=400, detail="Role name can't be empty.")
    if db.get(RolePermission, role):
        raise HTTPException(status_code=400, detail=f"A role named '{role}' already exists.")
    _validate_modules(payload.allowedModules)

    rp = RolePermission(role=role, allowed_modules=payload.allowedModules)
    db.add(rp)
    log_action(db, current_user.name, "Created role", f"{role} ({len(payload.allowedModules)} modules)")
    db.commit()
    db.refresh(rp)
    return to_out(rp)


@router.put("/{role}", response_model=RolePermissionOut)
def update_role_permission(
    role: str,
    payload: UpdateRolePermissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner")),
):
    rp = db.get(RolePermission, role)
    if not rp:
        raise HTTPException(status_code=404, detail="Role not found")
    _validate_modules(payload.allowedModules)

    rp.allowed_modules = payload.allowedModules
    log_action(db, current_user.name, "Updated role permissions", f"{role} ({len(payload.allowedModules)} modules)")
    db.commit()
    db.refresh(rp)
    return to_out(rp)


@router.delete("/{role}")
def delete_role_permission(
    role: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner")),
):
    rp = db.get(RolePermission, role)
    if not rp:
        raise HTTPException(status_code=404, detail="Role not found")
    if role in BUILT_IN_ROLES:
        raise HTTPException(status_code=400, detail=f"'{role}' is a built-in role and can't be deleted.")
    if db.query(User).filter(User.role == role).count() > 0:
        raise HTTPException(status_code=400, detail=f"Can't delete '{role}' — it's still assigned to at least one user.")

    db.delete(rp)
    log_action(db, current_user.name, "Deleted role", role)
    db.commit()
    return {"ok": True}
