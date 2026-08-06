from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.audit import log_action
from app.auth import create_token, hash_password, require_user, verify_password
from app.database import get_db
from app.models import User
from app.rate_limit import reset as reset_rate_limit
from app.rate_limit import record_attempt, seconds_until_allowed
from app.schemas import ChangePasswordRequest, CurrentUserOut, LoginRequest, LoginResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


def to_current_user_out(user: User) -> CurrentUserOut:
    return CurrentUserOut(
        id=user.id,
        name=user.name,
        username=user.username or "",
        email=user.email or "",
        role=user.role,
        mustChangePassword=user.must_change_password,
    )


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"{client_ip}:{payload.username}"

    wait = seconds_until_allowed(rate_key)
    if wait > 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many login attempts. Try again in {wait} seconds.",
            headers={"Retry-After": str(wait)},
        )

    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        record_attempt(rate_key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    reset_rate_limit(rate_key)
    token = create_token(user.id)
    response.set_cookie(
        "token",
        token,
        httponly=True,
        samesite="lax",
        max_age=8 * 60 * 60,
        path="/",
    )
    log_action(db, user.name, "Logged in", "-")
    return LoginResponse(redirect_url="/")


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("token", path="/")
    return {"ok": True}


@router.get("/me", response_model=CurrentUserOut)
def me(user_id: str = Depends(require_user), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return to_current_user_out(user)


@router.post("/change-password", response_model=CurrentUserOut)
def change_password(
    payload: ChangePasswordRequest,
    user_id: str = Depends(require_user),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    if not user.password_hash or not verify_password(payload.currentPassword, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")

    user.password_hash = hash_password(payload.newPassword)
    user.must_change_password = False
    log_action(db, user.name, "Changed own password", "-")
    db.commit()
    db.refresh(user)
    return to_current_user_out(user)
