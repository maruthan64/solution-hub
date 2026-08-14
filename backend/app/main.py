import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from app.database import Base, SessionLocal, engine
from app.models import RolePermission
from app.routers import (
    audit_logs,
    auth,
    capabilities,
    chat,
    diagrams,
    documents,
    knowledge_base,
    mcp_connectors,
    projects,
    role_permissions,
    search,
    service_catalog,
    settings,
    solution_packages,
    templates,
    users,
)
from app.routers.role_permissions import ALL_MODULES, BUILT_IN_ROLES

Base.metadata.create_all(bind=engine)


def _ensure_default_role_permissions() -> None:
    """The four built-in roles keep full sidebar access unless an Owner trims them —
    new custom roles (e.g. "Sales") start with none until explicitly granted modules.
    Also backfills newly-added nav modules (e.g. a later "/solution-packages") into the
    built-in roles' existing rows, so shipping a new page doesn't silently hide it from
    everyone who isn't a custom role — custom roles are left as an Owner scoped them."""
    db = SessionLocal()
    try:
        existing = {rp.role: rp for rp in db.query(RolePermission).all()}
        for role in BUILT_IN_ROLES - existing.keys():
            db.add(RolePermission(role=role, allowed_modules=list(ALL_MODULES)))
        for role in BUILT_IN_ROLES & existing.keys():
            rp = existing[role]
            missing = [m for m in ALL_MODULES if m not in rp.allowed_modules]
            if missing:
                rp.allowed_modules = [*rp.allowed_modules, *missing]
        db.commit()
    finally:
        db.close()


_ensure_default_role_permissions()

app = FastAPI(title="CloudSolution Hub API")

cors_origins = [o.strip() for o in os.getenv("CORS_ORIGIN", "http://localhost:3000").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(projects.router)
app.include_router(documents.router)
app.include_router(diagrams.router)
app.include_router(templates.router)
app.include_router(knowledge_base.router)
app.include_router(users.router)
app.include_router(audit_logs.router)
app.include_router(settings.router)
app.include_router(service_catalog.router)
app.include_router(mcp_connectors.router)
app.include_router(capabilities.router)
app.include_router(search.router)
app.include_router(role_permissions.router)
app.include_router(solution_packages.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
