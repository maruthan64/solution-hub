from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    username: Mapped[str | None] = mapped_column(String(120), unique=True, nullable=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str | None] = mapped_column(String(200), unique=True, nullable=True)
    role: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32), default="Active")
    password_hash: Mapped[str | None] = mapped_column(String(200), nullable=True)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    customer: Mapped[str] = mapped_column(String(200))
    cloud: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32))
    owner: Mapped[str] = mapped_column(String(120))
    updated: Mapped[str] = mapped_column(String(32))
    docs_generated: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[str] = mapped_column(Text, default="")
    source_document: Mapped[str | None] = mapped_column(String(300), nullable=True)
    capability_id: Mapped[str | None] = mapped_column(String(32), nullable=True)


class GeneratedDocument(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    project: Mapped[str] = mapped_column(String(200))
    type: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(200))
    version: Mapped[str] = mapped_column(String(16))
    updated: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text, default="")
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)


class DocTemplate(Base):
    __tablename__ = "templates"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    cloud: Mapped[str] = mapped_column(String(32))
    sections: Mapped[int] = mapped_column(Integer, default=1)
    description: Mapped[str] = mapped_column(Text)
    source_label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(400), nullable=True)
    content: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)


class DocumentDiagram(Base):
    """A single architecture diagram (mxGraph/draw.io XML) attached to a GeneratedDocument.
    One per document — png_path is a stable, document_id-keyed file re-rendered on every save."""

    __tablename__ = "document_diagrams"

    document_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    xml: Mapped[str] = mapped_column(Text, default="")
    png_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    updated_at: Mapped[str] = mapped_column(String(32), default="")


class KnowledgeDoc(Base):
    __tablename__ = "knowledge_docs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(300))
    category: Mapped[str] = mapped_column(String(120))
    uploaded_by: Mapped[str] = mapped_column(String(120))
    uploaded: Mapped[str] = mapped_column(String(32))
    size: Mapped[str] = mapped_column(String(32))
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)


class AuditEntry(Base):
    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    actor: Mapped[str] = mapped_column(String(120))
    action: Mapped[str] = mapped_column(String(200))
    target: Mapped[str] = mapped_column(String(300))
    timestamp: Mapped[str] = mapped_column(String(32))


class AppSettings(Base):
    __tablename__ = "app_settings"

    id: Mapped[str] = mapped_column(String(16), primary_key=True, default="singleton")
    # "claude_cli" (local `claude -p` subprocess) or "bedrock" (direct HTTPS call to the
    # Bedrock Runtime Converse API using an AWS Bedrock API key bearer token)
    ai_provider: Mapped[str] = mapped_column(String(32), default="claude_cli")
    org_name: Mapped[str] = mapped_column(String(200), default="Solution Architecture Team")
    default_cloud: Mapped[str] = mapped_column(String(32), default="AWS")
    default_export_format: Mapped[str] = mapped_column(String(16), default="DOCX")
    # AWS Bedrock API key (a bearer token, not an Access Key ID/Secret Access Key pair) —
    # see https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys.html. Entered
    # directly in Settings; read fresh from this row on every AI call, nothing to bridge
    # into process env vars since the call is a plain HTTPS request, not boto3/litellm.
    # Text, not a bounded VARCHAR: real keys embed a full signed request internally and
    # run 2000+ characters — String(500) truncated silently under SQLite (no length
    # enforcement) but would hard-fail on Postgres, same class of bug as Capability.id.
    bedrock_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    bedrock_region: Mapped[str | None] = mapped_column(String(32), nullable=True)
    bedrock_model: Mapped[str | None] = mapped_column(String(200), nullable=True)


class ServicePackage(Base):
    __tablename__ = "service_packages"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    category: Mapped[str] = mapped_column(String(16))  # "tier" | "container"
    name: Mapped[str] = mapped_column(String(120))
    tagline: Mapped[str] = mapped_column(String(300))
    monthly_price: Mapped[str] = mapped_column(String(32))
    resources: Mapped[list] = mapped_column(JSON)  # [{service, quantity, purpose}, ...]


class Quote(Base):
    """A generated Service Catalog quote, snapshotted and linked back to the Project it was
    generated for — the pricing-side counterpart to a Project's Generated Documents."""

    __tablename__ = "quotes"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(32))
    customer_name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    package_ids: Mapped[list] = mapped_column(JSON)
    total: Mapped[str] = mapped_column(String(32))
    format: Mapped[str] = mapped_column(String(16))
    created: Mapped[str] = mapped_column(String(32))
    created_by: Mapped[str] = mapped_column(String(120))


class Capability(Base):
    """A named practice/solution area the org can deliver (e.g. 'AWS Contact Center') —
    a capability matrix, distinct from Service Catalog's sellable pricing tiers."""

    __tablename__ = "capabilities"

    # Wider than the usual String(32) id columns — capabilities.py's own create endpoint
    # generates short uuid-hex ids that would fit in 32, but seed.py's human-readable
    # slugs (e.g. "cap-kubernetes-container-platforms") run over 32 chars. SQLite never
    # enforces VARCHAR length at all, so this only surfaced once seeding against real
    # Postgres, which does.
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    cloud: Mapped[str] = mapped_column(String(32))
    description: Mapped[str] = mapped_column(Text, default="")
    key_services: Mapped[list] = mapped_column(JSON, default=list)  # ["Amazon Connect", "Amazon Lex", ...]
    status: Mapped[str] = mapped_column(String(16), default="Active")  # "Active" | "Planned"
    github_url: Mapped[str | None] = mapped_column(String(400), nullable=True)
    certifications: Mapped[list] = mapped_column(JSON, default=list)  # ["AWS Advanced Consulting Partner", ...]
    case_studies: Mapped[list] = mapped_column(JSON, default=list)  # [{customer, outcome}, ...]
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)
