import re
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.audit import log_action
from app.auth import hash_password, require_role, require_user
from app.database import get_db
from app.models import User
from app.rate_limit import is_username_locked, unlock_username
from app.schemas import (
    CreateUserRequest,
    CreateUserResponse,
    ResetPasswordRequest,
    UpdateUserRoleRequest,
    UserOut,
)

router = APIRouter(prefix="/api/users", tags=["users"])

VALID_ROLES = {"Owner", "Architect", "Reviewer", "Viewer"}


USERNAME_RE = re.compile(r"^[a-z0-9.]+$")


def to_out(u: User) -> UserOut:
    return UserOut(id=u.id, name=u.name, email=u.email, role=u.role, status=u.status, locked=is_username_locked(u.username))


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _user: str = Depends(require_user)):
    return [to_out(u) for u in db.query(User).all()]


@router.post("", response_model=CreateUserResponse, status_code=201)
def create_user(
    payload: CreateUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner")),
):
    if payload.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"role must be one of {sorted(VALID_ROLES)}")

    email = payload.email.strip() if payload.email and payload.email.strip() else None
    if email and db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="A user with that email already exists.")

    username = payload.username.strip().lower()
    if not USERNAME_RE.match(username):
        raise HTTPException(status_code=400, detail="Username can only contain lowercase letters, numbers, and dots.")
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail=f"Username '{username}' is already taken.")

    user = User(
        id=f"u-{uuid.uuid4().hex[:8]}",
        username=username,
        name=payload.name,
        email=email,
        role=payload.role,
        status="Active",
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    log_action(db, current_user.name, "Created user", f"{payload.name}" + (f" ({email})" if email else ""))
    db.commit()
    db.refresh(user)
    return CreateUserResponse(user=to_out(user), username=username)


@router.put("/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: str,
    payload: UpdateUserRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner")),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"role must be one of {sorted(VALID_ROLES)}")
    if user.role == "Owner" and payload.role != "Owner" and db.query(User).filter(User.role == "Owner").count() <= 1:
        raise HTTPException(status_code=400, detail="Can't change the role of the last remaining Owner.")

    old_role = user.role
    user.role = payload.role
    log_action(db, current_user.name, "Changed user role", f"{user.name}: {old_role} → {payload.role}")
    db.commit()
    db.refresh(user)
    return to_out(user)


@router.post("/{user_id}/reset-password", response_model=UserOut)
def reset_password(
    user_id: str,
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner")),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password(payload.password)
    user.must_change_password = True
    log_action(db, current_user.name, "Reset password for user", user.name)
    db.commit()
    db.refresh(user)
    return to_out(user)


@router.post("/{user_id}/unlock", response_model=UserOut)
def unlock_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner")),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    cleared = unlock_username(user.username)
    if cleared:
        log_action(db, current_user.name, "Unlocked user login", user.name)
        db.commit()
    return to_out(user)


@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("Owner")),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You can't delete your own account.")
    if user.role == "Owner" and db.query(User).filter(User.role == "Owner").count() <= 1:
        raise HTTPException(status_code=400, detail="Can't delete the last remaining Owner.")

    name = user.name
    email = user.email
    db.delete(user)
    log_action(db, current_user.name, "Deleted user", f"{name}" + (f" ({email})" if email else ""))
    db.commit()
    return {"ok": True}
