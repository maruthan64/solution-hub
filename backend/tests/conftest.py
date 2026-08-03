import atexit
import os
import tempfile
import uuid

import pytest

# Must happen before any `app.*` import: app.main runs Base.metadata.create_all(bind=engine)
# at module import time, so DATABASE_URL has to point at a throwaway DB before that happens.
_db_fd, _db_path = tempfile.mkstemp(suffix=".db")
os.close(_db_fd)
os.environ["DATABASE_URL"] = f"sqlite:///{_db_path}"
os.environ.setdefault("JWT_SECRET", "test-secret-do-not-use-in-prod")
def _cleanup_db_file() -> None:
    try:
        os.remove(_db_path)
    except OSError:
        # Windows keeps the file locked while the SQLite engine's connection is
        # still alive at interpreter shutdown - harmless, it's in the OS temp dir.
        pass


atexit.register(_cleanup_db_file)

from fastapi.testclient import TestClient  # noqa: E402

from app.auth import hash_password  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User  # noqa: E402


@pytest.fixture()
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def make_user(db_session):
    """Factory fixture: make_user(role="Owner") -> (User, plaintext_password)."""

    def _make(role: str = "Owner", password: str = "testpass123") -> tuple[User, str]:
        uname = f"user-{uuid.uuid4().hex[:8]}"
        user = User(
            id=f"u-{uuid.uuid4().hex[:8]}",
            username=uname,
            name=uname,
            email=f"{uname}@example.com",
            role=role,
            status="Active",
            password_hash=hash_password(password),
        )
        db_session.add(user)
        db_session.commit()
        return user, password

    return _make


@pytest.fixture()
def auth_client(client, make_user):
    """A TestClient already logged in as an Owner, with the session cookie set."""
    user, password = make_user(role="Owner")
    resp = client.post("/api/auth/login", json={"username": user.username, "password": password})
    assert resp.status_code == 200
    return client
