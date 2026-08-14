# CloudSolution Hub — Project Documentation

This is retrospective documentation of the application **as it exists today** —
every feature, model, and endpoint named here is real and verified against the
codebase (backend: 77 pytest tests passing; frontend: 8 vitest tests passing).
Where something is a known gap rather than a built feature, it's labeled as such
rather than glossed over.

Six sections, following the standard pre-build planning-doc set — written here
after the fact, as living documentation of what was actually built:

1. [Product Requirements (PRD)](#1-product-requirements-document-prd)
2. [Technical Requirements (TRD)](#2-technical-requirements-document-trd)
3. [App Flow](#3-app-flow)
4. [UI/UX Design Brief](#4-uiux-design-brief)
5. [Backend Schema](#5-backend-schema)
6. [Implementation Plan (what's next)](#6-implementation-plan-whats-next)

---

## 1. Product Requirements Document (PRD)

### Problem statement

Solution architects at a cloud service provider/reseller currently produce
customer-facing deliverables (Solution Design Documents, ADRs, BOMs, quotes) as
one-off Word documents and spreadsheets, with no shared templates, no
centralized review process, and no audit trail of who changed what. Pricing
quotes are rebuilt from scratch per engagement rather than derived from a
consistent service catalog.

### Who it's for

Four roles, enforced by real role-based access control (`app/auth.py`,
`require_role(...)` dependency on every mutating endpoint):

| Role | Can do |
|---|---|
| **Owner** | Everything, including user management, settings, and role changes |
| **Architect** | Create/edit projects, documents, templates, service packages |
| **Reviewer** | Approve/reject documents submitted for review |
| **Viewer** | Read-only |

### Core features (built and verified)

- **Projects** — central record per customer engagement (cloud, status,
  customer, linked capability, linked documents/quotes)
- **AI Chat** — conversational scoping assistant; "Create Project from this
  Chat" extracts a structured project (name/customer/cloud/description) from
  the conversation
- **Templates** — reusable document skeletons per cloud provider; can start
  blank, from an uploaded Word/PDF/Markdown file (headings, bold, lists, and
  tables preserved via a real Word-structure-aware conversion — not a plain
  text dump), or be duplicated from an existing one
- **AI-assisted drafting** — "Ask AI" drafts or rewrites a section of any
  Template or Document, given the current content and a plain-English
  instruction
- **Documents** — generated per-project from a Template; real review workflow
  (Draft → In Review → Approved, with request-changes notes; editing an
  Approved document auto-reverts it to Draft)
- **Architecture Diagrams** — one per Document, AI-drafted or hand-drawn via
  an embedded draw.io canvas, exported as a real image inside the Word/PDF
- **Service Catalog** — fixed-price tiers, add-ons, and container packages;
  cart-based quote generation (Word/PDF/branded Proposal) with a real computed
  total from the selected packages
- **Cost Estimator** — saves a computed line-item document directly onto a
  Project from Service Catalog selections (not an AI guess)
- **Knowledge Base** — upload/download/delete reference files by category
- **Capability Matrix** — tracks practice areas, certifications, case studies
  the org can deliver
- **Global Search** — one search bar across Projects, Documents, Templates,
  and Knowledge Base
- **Audit Log** — every meaningful write (login, edit, quote generated, user
  invited, etc.) logged with actor/action/target/timestamp
- **Connectors** — reflects and manages real Claude Code MCP servers
- **Users** — invite (Owner sets an initial password directly — no email
  sending, by design), role changes, password reset, forced password rotation
  on first login
- **Settings** — org branding fields, AI provider selection (AWS Bedrock or
  Claude CLI) with a **Test Connection** button that makes one real request to
  verify credentials actually work

### Explicit non-goals (deferred, not overlooked)

- Semantic/RAG search over Knowledge Base content (currently filename/title
  search only)
- S3/object storage for uploads (local disk on the single EC2 instance, by
  deliberate cost-minimal design)
- Email notifications of any kind (invites are manual credential handoff by
  design; nobody is notified when a document needs review)
- SSO/SAML — username + password only
- Real-time collaborative editing / live Office-document embedding (the
  WOPI/Office-Online/Collabora infrastructure this would need was evaluated
  and rejected as disproportionate to a cost-minimal internal tool)
- AI usage/cost tracking or observability

---

## 2. Technical Requirements Document (TRD)

### Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Ant Design 5, Tailwind CSS |
| Backend | FastAPI, SQLAlchemy 2.0, Pydantic 2 |
| Database | SQLite (dev) / PostgreSQL (production) — same schema, driven by `DATABASE_URL` |
| Auth | JWT in an httpOnly cookie (`app/auth.py`), bcrypt password hashing, 8-hour token TTL |
| AI | **AWS Bedrock** — direct HTTPS call to the Bedrock Runtime Converse API using an AWS Bedrock API key (bearer token) — no boto3, no AWS SigV4 signing. **Claude CLI** — subprocess call to a local `claude -p`, using an existing Claude Code login instead of API billing |
| Word import | `mammoth` (.docx → HTML, understands real Word structure) → `markdownify` (HTML → this app's Markdown) |
| Word/PDF export | `python-docx` and `reportlab`, converting the app's Markdown back into native Word styles / PDF paragraphs |
| Diagrams | `embed.diagrams.net` (draw.io) iframe embed — the app stores the exact mxGraph XML draw.io produces, no format translation |
| Infra | Single EC2 instance (`t4g.micro`, `ap-south-1`), nginx reverse proxy, systemd units, provisioned via Terraform (`docs/deployment/main.tf`) |

### Why AWS Bedrock over LiteLLM/boto3 (a real migration that happened)

The app originally routed all AI calls through `litellm.completion()`, including
Bedrock via boto3 + AWS SigV4 signing (Access Key ID + Secret Access Key). This
was replaced because **boto3 was never actually installed**, so every Bedrock
call failed. Rather than just installing boto3, the app moved to AWS's newer
**Bedrock API keys** (a single bearer token, generated from the Bedrock
console) — simpler, and it removes an entire dependency (`litellm` + `boto3`)
in favor of one `httpx.post()` call with an `Authorization: Bearer` header.

### Infrastructure shape and cost

No ALB, no RDS, no NAT Gateway — everything on one box:

```
Browser → Route 53 (optional) → Elastic IP → nginx (:80/:443)
                                                 ├─→ Next.js (:3000, 127.0.0.1 only)
                                                 └─→ FastAPI (:8000, 127.0.0.1 only) → Postgres (same box)
```

Rough cost: **$8–10/month** (`t4g.micro` + 20GB gp3 EBS + Route 53 zone), versus
$70–100+/month for the standard ALB+RDS+NAT shape. This is a deliberate,
documented tradeoff (`docs/deployment/deploy-aws.md`), not an oversight — it trades
away high availability, automated backups, and autoscaling for cost, which is
the right call at this team's current scale.

### Security posture

- bcrypt password hashing, JWT auth, role-gated endpoints on every mutation
- Login rate limiting (`app/rate_limit.py`) — **in-memory**, resets on a
  backend restart (acceptable at current scale, a real limitation at larger
  scale)
- **Forced password rotation**: every user has a `must_change_password` flag
  (defaults `true`); a blocking modal appears on next login until resolved.
  Set on: initial seed, Owner-issued invite, Owner-triggered password reset
- Full audit trail via `AuditEntry`

### Testing

- **Backend**: 77 pytest tests (`backend/tests/`) — auth, rate limiting, role
  enforcement, document export, AI extraction (including three real regression
  tests for the mammoth pipeline: heading preservation, table preservation,
  and image stripping), search, settings, quotes
- **Frontend**: 8 vitest tests (`frontend/lib/api.test.ts`)
- CI: GitHub Actions (`.github/workflows/ci.yml`), backend and frontend jobs
  scoped to their own folders

### Known technical debt (real, currently unfixed)

- **Markdown export only supports Heading 1–4** (`document_export.py`'s
  `HEADING_PATTERN` caps at `#{1,4}`), but the Word-import pipeline can now
  produce Heading 5/6 from real documents — those headings preview fine
  in-browser but silently lose all heading formatting on export
- Standalone Service Catalog quotes (no linked Project) are generated and
  downloaded but **never persisted** — no sales history for them
- No document-level reviewer assignment — "Pending Review" is visible to any
  authenticated user, not routed to a specific person
- No malware/virus scanning on uploaded files
- File uploads live on local disk, not object storage — fine for one
  instance, would need real changes to support horizontal scaling

---

## 3. App Flow

### Authentication

```
Login (username + password)
  → JWT set as httpOnly cookie
  → GET /api/auth/me returns mustChangePassword
  → if true: blocking "Set a new password" modal, no navigation until resolved
  → normal app access
```

### Path A — Scoping conversation → Project

```
AI Chat: describe the engagement conversationally
  → AI asks clarifying questions (cloud, region, compute, compliance)
  → "Create Project from this Chat"
  → AI extracts {name, customer, cloud, description}
  → New Project modal, pre-filled, user reviews/edits
  → Project created
```

### Path B — Template-driven document generation

```
Pick a Template (by cloud provider)
  → optionally seed it from an uploaded Word/PDF/Markdown file
    (headings/bold/lists/tables preserved, images stripped)
  → "Ask AI" drafts specific sections on instruction
  → AI-drafted or hand-drawn architecture diagram (draw.io embed)
  → Submit for Review (Draft → In Review)
  → Reviewer approves or requests changes (back to Draft)
  → Export to Word and/or PDF
```

### Path C — Pricing / Service Catalog

```
Browse Service Catalog (tiers / containers / add-ons)
  → add to cart
  → optionally link to a Project
  → Generate Quote (Word / PDF / branded Proposal), real computed total
    → if linked to a Project: persisted to that Project's quote history
    → if standalone: downloaded only, not persisted (known gap)
  → or: Save as Cost Estimate Document — writes a real line-item document
    onto the Project
```

### Path D — Knowledge Base & Search

```
Upload a reference file → categorized, stored on disk
Global search bar (header) → queries Projects/Documents/Templates/
  Knowledge Base by name/title → grouped results, 2+ characters, debounced
```

### Path E — Administration

```
Users: invite (Owner sets an initial password directly, no email) →
  new account flagged must_change_password
Settings: pick AI provider (Bedrock/Claude CLI) → enter credentials if
  Bedrock → Test Connection (makes one real request) → Save
```

---

## 4. UI/UX Design Brief

### Baseline visual system

Ant Design 5's default theme (primary blue `#1677ff`) plus Tailwind utility
classes for layout — white cards on a `gray-50` page background, used
consistently across Dashboard, Projects, Documents, Templates, Service
Catalog, Knowledge Base, Capabilities, Users, Audit Logs, and Settings. This
is the app's "house style" — most pages deliberately look like the same
product, not each reaching for its own visual identity.

### Where the design deliberately breaks from the baseline

- **Login page** — a "Blueprint" concept: drafting-grid background, a
  "redline" accent (the color architects use to mark up drawings) instead of
  default AntD blue, and AWS/Azure/GCP/Kubernetes shown as dashed-border
  annotation "stamps" rather than official logos. Justified because it's the
  one unauthenticated page and the one place a distinct first impression
  matters; the rest of the app stays in the shared house style.
- **AI Chat** — LibreChat-inspired empty-state greeting and floating pill
  composer, with a "+" menu scoped to real actions only (Create Project from
  this Chat, Clear Conversation) — deliberately not copying LibreChat's File
  Search/Web Search/Run Code, since this app doesn't implement any of those.

### Dashboard

Four stat cards, all backed by real data (no placeholder/fake numbers):
Active Projects, Documents Generated, Pending Review, Quotes Generated
(month-filtered). A "Needs Your Review" panel turns the pending-review count
into an actionable list (title, last-updated, a direct link) rather than a
number nobody can act on. Recent Projects and Recent Documents tables below.

### Settings

Sidebar-categorized layout (General / AI Provider) rather than a long
scrolling stack of cards — mirrors the "categories + row groups" pattern from
familiar settings UIs (theme/language-style rows with pill-shaped controls).
Provider-specific fields (Bedrock credentials, or a plain info note for
Claude CLI) appear inline under the Provider dropdown, not behind a separate
tab — picking a provider and configuring it happens in one place.

### Document Preview

Renders the stored Markdown through the same visual convention the eventual
Word/PDF export uses (serif body text, sans-serif headings with rule lines,
bordered tables) — so what you see in Preview is a faithful approximation of
the exported file, not a generic markdown-viewer look.

### Global Search

A single input in the header; results appear grouped by type (Projects /
Documents / Templates / Knowledge Base) in a dropdown, each with an icon and
a one-line subtitle for context, clicking navigates directly to that record.

---

## 5. Backend Schema

Eleven SQLAlchemy models (`backend/app/models.py`), same schema on SQLite
(dev) and PostgreSQL (production):

```
User (users)
  id, username (unique), name, email (unique), role, status,
  password_hash, must_change_password

Project (projects)
  id, name, customer, cloud, status, owner, updated, docs_generated,
  description, source_document, capability_id

GeneratedDocument (documents)
  id, project, type, title, version, updated, status, content,
  review_note

DocTemplate (templates)
  id, name, cloud, sections, description, source_label, source_url,
  content, updated_at

DocumentDiagram (document_diagrams)
  document_id (PK, 1:1 with a document), xml, png_path, updated_at

KnowledgeDoc (knowledge_docs)
  id, name, category, uploaded_by, uploaded, size, file_path

AuditEntry (audit_log)
  id, actor, action, target, timestamp

AppSettings (app_settings) — singleton row
  id="singleton", ai_provider, org_name, default_cloud,
  default_export_format, bedrock_api_key, bedrock_region, bedrock_model

ServicePackage (service_packages)
  id, category ("tier"|"container"|"addon"), name, tagline,
  monthly_price, resources (JSON: [{service, quantity, purpose}])

Quote (quotes)
  id, project_id, customer_name, description, package_ids (JSON),
  total, format, created, created_by
  — only ever written when generated with a project_id (see TRD gaps)

Capability (capabilities)
  id, name, cloud, description, key_services (JSON), status,
  github_url, certifications (JSON), case_studies (JSON), updated_at
```

Twelve backend routers (`backend/app/routers/`), each owning one resource:
`auth`, `projects`, `documents`, `diagrams`, `templates`, `knowledge_base`,
`users`, `audit_logs`, `settings`, `service_catalog`, `mcp_connectors`,
`capabilities`, plus `search` for the cross-entity global search endpoint.

---

## 6. Implementation Plan (what's next)

Ranked by how directly each closes a real, already-identified gap rather than
a hypothetical one:

1. **Extend Markdown export to Heading 5/6** — `document_export.py`'s
   `HEADING_PATTERN` currently caps at 4 levels; the Word-import pipeline can
   now produce 6. Small, contained fix; already scoped, not yet built.
2. **Insert a real Word Table of Contents field on export** — not static,
   page-numbered text (which goes stale the moment anything changes — this is
   exactly why the SOW test document's own auto-generated ToC was stripped
   during cleanup), but an actual Word ToC *field* (`TOC \o` field code) that
   Word recalculates live whenever the document is opened or updated. Small,
   pairs naturally with #1 since both are about heading-level fidelity in the
   export path.
3. **Branded Word export — staged, not a single big build.** See "Branded
   export architecture decision" below for the full reasoning; short version:
   - **3a. (near-term)** Add an explicit choice at template-upload time:
     *"Branded shell"* (logo/header/footer/cover page only, AI drafts the
     entire body) vs. *"Complex existing document"* (has real content
     throughout — tables, multi-level sections — that must survive
     unchanged). For "branded shell" templates, keep improving the existing
     Markdown → `markdown_to_docx` path; that's the common case and it
     already works.
   - **3b. (deferred until real demand)** For "complex existing document"
     templates, build the anchored-assembly architecture: Word **content
     controls** (`document_body`, `executive_summary`, etc.) mark the
     editable regions inside an uploaded master; export clones the original
     `.docx`, converts only the Markdown at each anchor to native
     WordprocessingML using the master's own styles, and leaves every other
     part of the original document — cover page, existing tables, section
     breaks, headers/footers — byte-for-byte untouched. Until this exists,
     a complex document like the 18-table SOW is better treated as a
     reference a human finishes directly in Word, not something the app
     tries to fully regenerate.
   - **3c. (separate decision, only if pixel-fidelity PDF matters)** Replace
     or supplement the from-scratch `reportlab` PDF path with a real
     document-rendering engine (LibreOffice headless: `soffice --headless
     --convert-to pdf`) — `reportlab` has no awareness of Word's own
     pagination or field calculation, so it can never be pixel-faithful to
     the actual generated `.docx`. This adds a real system dependency
     (LibreOffice via apt) to the EC2 instance, unlike every other export
     dependency added so far, which is worth deciding deliberately rather
     than adding quietly.
4. **Reviewer assignment** — add an optional assigned-reviewer field to
   `GeneratedDocument`; scope the "Needs Your Review" panel to "assigned to me
   or unassigned" instead of showing to every user.
5. **Persist standalone quotes** — make `project_id` nullable on `Quote`
   instead of skipping the DB write entirely when absent, so there's a real
   record of every quote generated, not just project-linked ones.
6. **AI usage/cost tracking** — log every AI call (provider, latency,
   success/failure) so the (now-removed) fake dashboard numbers can eventually
   be replaced with real ones, if this is prioritized.
7. **CI/CD to the EC2 instance** — deploys today are `bash docs/deployment/sagen.sh
   deploy` run by hand over SSH. A GitHub Actions workflow triggered on push
   (or manual dispatch) would automate this.
8. **RAG/semantic Knowledge Base search** — deferred by explicit choice, not
   forgotten. Revisit only if filename/title search genuinely stops being
   sufficient.
9. **S3/object storage for uploads** — deferred by explicit choice, tied to
   the broader single-instance cost-minimal shape. Revisit only alongside a
   genuine decision to outgrow that shape (see TRD's documented HA tradeoffs).

### Branded export architecture decision

Two approaches were evaluated for getting AI-drafted Markdown content into a
branded, Word-native deliverable (logo, header/footer, working Table of
Contents), and it's worth recording *why* one was picked over the other,
since both are reasonable-sounding at first glance:

**Rejected as the primary path: subdocument merge** (`docxtpl`'s
`new_subdoc()`, or Pandoc's `--reference-doc`). Merging a generated body into
a master template this way risks real conflicts between the two documents'
style IDs, numbering/list IDs, image and hyperlink relationship IDs,
footnotes/comments/bookmarks, table styles, section properties, and theme
fonts — `docxtpl`'s own issue tracker documents formatting loss from exactly
this. Separately, Pandoc's `--reference-doc` only borrows the reference
document's *styles*, not its *content* — it can't preserve a master's actual
cover page or existing tables, which rules it out for anything beyond "get
consistent fonts and margins."

**Chosen direction: anchored assembly.** Treat the original uploaded `.docx`
as the canonical structural document — never round-tripped through Markdown
in full. Mark editable regions with real Word content controls
(`document_body`, `executive_summary`, etc.). Export clones the original
file, converts Markdown to native WordprocessingML *only* at those anchors
using the master's own styles, and copies every other part of the original
document through unchanged as an opaque block. This is more moving parts to
build than a subdoc merge, but far fewer failure modes, since it never asks
two independently-authored OOXML documents to reconcile their internal IDs.

**The reason this isn't being built immediately**: it requires template
authors to place content controls in Word (a real skill/workflow shift from
today's "just upload any `.docx`"), and it's the right investment only once
there's real, recurring demand for preserving complex existing documents.
Until then, staged item 3a above (a simple "branded shell" path for the
common case, "complex document" templates treated as human-finished
references) captures most of the value at a fraction of the cost.

### Regression fixture: the 18-table Statement of Work

The real SoftwareOne SOW template used to build and validate the
`mammoth`-based import pipeline (see TRD) should become a permanent test
fixture once the anchored-assembly work (3b) starts, covering cases the
current test suite does not yet exercise:

- Merged cells (the two "Escalation Path" tables have a merged header cell —
  markdown tables can't represent this natively; current behavior after
  cleanup is a single-column header row, which is a reasonable approximation
  but not a perfect one)
- Nested and adjacent tables (several sections have two visually-continuous
  tables that are actually separate `<w:tbl>` elements — e.g. the
  "Infrastructure Migration" table split across two blocks)
- Table styles and column widths
- Repeating header rows across a page break
- Headings that appear inside table cells
- Numbered and bulleted lists, including nested ones
- Section/page breaks
- Header/footer preservation end to end
- Table of Contents and Navigation Pane behavior after the real-ToC-field
  change (item 2 above)
