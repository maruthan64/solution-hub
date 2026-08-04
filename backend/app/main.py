import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from app.database import Base, engine
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
    service_catalog,
    settings,
    templates,
    users,
)

Base.metadata.create_all(bind=engine)

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


@app.get("/api/health")
def health():
    return {"status": "ok"}
