# CloudSolution Hub

An internal tool for a cloud service provider/reseller: solution architects generate
customer-facing documents (Solution Design Documents, ADRs, BOMs, quotes), manage a
productized service catalog (fixed-price tiers + add-ons), maintain reusable templates
and organizational knowledge, and get AI assistance drafting content — all from one app.

## Objective

Replace ad-hoc, inconsistent architecture documentation with a single tool that:
- Generates real Word/PDF documents (not just displays them) from Markdown content
- Lets architects sell productized service tiers (Basic/Intermediate/Advanced +
  container/add-on packages) and turn a customer's selection into a branded quote
- Centralizes templates, company standards (Knowledge Base), and audit history
- Routes AI drafting through a swappable backend (AWS Bedrock via a direct API key, or a
  local Claude Code CLI subprocess) so it isn't locked to one provider

## Components

| Area | Page(s) | Backend router |
|---|---|---|
| Dashboard | `/` | `projects.py`, `documents.py` |
| Projects | `/projects` | `projects.py` |
| Service Catalog | `/service-catalog` | `service_catalog.py` |
| AI Chat | `/chat` | `chat.py` |
| Documents | `/documents` | `documents.py` |
| Knowledge Base | `/knowledge-base` | `knowledge_base.py` |
| Templates | `/templates` | `templates.py` |
| Connectors (MCP) | `/connectors` | `mcp_connectors.py` |
| Users | `/users` | `users.py` |
| Audit Logs | `/audit-logs` | `audit_logs.py` |
| Settings | `/settings` | `settings.py` |
| Auth | `/login` | `auth.py` |

## How to Use

**1. Log in** at `/login` (default `admin` / `admin123`, see Local Development below).

**2. Create a project** — Projects → New Project. Fill in Name, Customer, Cloud, and a
description, and optionally pick a **Starting Template**. If you pick a template, the AI
drafts a real document from it on the spot (using the project's name/customer/cloud/
description as instructions) — it lands under that project as a Generated Document,
status `Draft`. Skip the template and no document is created yet.

**3. Edit a document** — open it from Documents or from a project's "Generated
Documents" table. You can type directly into the editor (it's Markdown — `#`/`##`
headings, `**bold**`, `| table | cells |`), or use the **AI Assistant** panel: give it an
instruction (e.g. *"Fill in the Cost Estimate assumptions for a 3-node cluster"*), hit
**Ask AI**, then **Append to editor** or **Replace all** the suggestion. Nothing is saved
until you click **Save Changes**.

**4. Add an architecture diagram** — click **Diagram** on a document to open an
embedded draw.io (diagrams.net) canvas. **Ask AI to draft** generates a starting
diagram using real AWS/Azure/GCP icons based on the project's cloud; hand-edit it like
any normal draw.io diagram, **Save** to persist it, then pick where it should land
(end of document, or directly under an existing heading) and **Insert into document**.
Re-inserting after further edits moves the image to the newly chosen spot instead of
leaving a duplicate behind. Word/PDF export renders it as a real embedded picture, not
a broken link.

**5. Preview before sharing** — the **Preview** button renders the Markdown as it will
actually look (headings, tables, bold, embedded diagrams), so you can sanity-check
before exporting. **Markdown** downloads the raw file client-side; **Word**/**PDF** hit
the backend and auto-save any unsaved edits first, so the export always matches what's
on screen. Templates support the same Preview/AI-Assist/export flow — they're just your
org's reusable starting point, not a customer deliverable, so they skip the review
workflow.

**6. Review and approve a document** — documents move through `Draft → In Review →
Approved`. Owner/Architect can **Submit for Review**; Owner/Reviewer can then
**Approve** or **Request Changes** (which requires a note and sends it back to Draft,
showing that note as a banner until resubmitted). Editing an Approved or In-Review
document automatically reverts it to Draft (this includes inserting/re-inserting a
diagram), so "Approved" always reflects reviewed content, never stale content.

**7. Build a quote or a cost estimate** — Service Catalog → click a tier/add-on card for
full resource details, **Add to Cart** the ones a customer wants, optionally **Compare**
a couple side by side. Use **New Package** to add a new Tier/Container/Add-On to the
catalog (previously only editing existing ones was possible). Optionally pick **Link to
Project** (works whether you arrived here via a project's **Generate Quote** button, which
pre-fills it, or navigated to `/service-catalog` directly) — linking makes the generated
quote show up on that project's **Quotes** table. Fill in Customer Name + Description and
**Generate Quote** for a Word/PDF/branded Proposal with a real computed total, or, with a
project linked, **Save as Cost Estimate Document** to turn the same selection into a real
computed Markdown table (not AI-guessed numbers) saved as that project's editable **Cost
Estimate** document — regenerating it updates the same document rather than creating a
duplicate.

**8. Scope with AI Chat, then create a project from it** — `/chat` is a real multi-turn
conversation (via whichever AI provider is selected in Settings) for talking through a
solution before committing to a project. Once you've discussed enough, **Create Project
from this Chat** asks the AI to summarize the conversation into a name/customer/cloud/
description, then opens **New Project** pre-filled with its best guess — review and edit
before creating, same as any other new project. (The conversation itself isn't saved
server-side, so this only works within the same browser session — refreshing `/chat`
starts over.)

**9. Everything else** — Knowledge Base (upload/download org standards), Users (invite
teammates, sets their role), Connectors (manage real Claude Code MCP servers), Audit
Logs (a real log of every write action), Settings (AI provider, org info, API key).

## Framework / Tech Stack

**Frontend** — Next.js 15 (App Router) · React 19 · TypeScript · Ant Design 5 · Tailwind
(utility classes only, no custom design system)

**Backend** — FastAPI · SQLAlchemy · Pydantic · Uvicorn

**Database** — SQLite for local dev (`backend/sagenerator.db`); schema is
Postgres-compatible and `docker-compose.yml` provisions a Postgres container for when
you're ready to switch (`DATABASE_URL` in `backend/.env`)

**AI** — AWS Bedrock (a direct HTTPS call to the Bedrock Runtime Converse API using an
AWS Bedrock API key bearer token — no boto3, no AWS SigV4 signing) **or** a local
`claude -p` subprocess using your existing Claude Code login. Selectable per-deployment
in Settings → AI Assistant.

**Document generation** — `python-docx` (Word), `reportlab` (PDF). No template engine —
Markdown-ish content is parsed and rendered directly into native Word/PDF structures
(real heading styles, real tables, real bold — not styled monospace text).

**Auth** — JWT in an httpOnly cookie (`PyJWT` + `bcrypt`), role-based access control
(Owner/Architect/Reviewer/Viewer) enforced on sensitive write endpoints.

## Flow

```
Browser
  │
  ▼
Next.js (:3000) ── same-origin fetch, credentials via cookie
  │
  │  next.config.mjs rewrites /api/* → BACKEND_URL
  ▼
FastAPI (:8000)
  │
  ├── SQLAlchemy ──▶ SQLite / Postgres
  ├── httpx ──▶ Bedrock Runtime Converse API (bearer token)  (AI Assistant: bedrock mode)
  ├── subprocess `claude -p`                                 (AI Assistant: claude_cli mode)
  ├── subprocess `claude mcp ...`                             (Connectors page)
  ├── python-docx / reportlab ──▶ generated .docx / .pdf      (Templates, Documents, Quotes)
  └── local disk (backend/uploads/) ──▶ Project & Knowledge Base file uploads,
                                          rendered diagram PNGs (uploads/diagrams/)

Browser also embeds https://embed.diagrams.net directly (draw.io, Apache-2.0,
free for internal use) as an iframe for the Diagram editor — the canvas itself
runs entirely client-side; only Save/AI-draft/PNG-export round-trip to the backend.
```

**A typical session:**
1. Log in → backend issues a JWT cookie.
2. Scope in AI Chat, then **Create Project from this Chat** to hand off a summarized
   name/customer/cloud/description into a reviewable New Project form — or just create
   the project directly from a template.
3. Pick a Template or Document, optionally ask the AI Assistant to draft a section
   (routed through AWS Bedrock or the local Claude CLI, whichever Settings selects), add
   an AI-drafted/hand-edited architecture diagram → export to Word or PDF.
4. Or: build a quote or cost estimate in the Service Catalog — add tiers/add-ons to the
   cart, optionally link a Project, generate a Word/PDF/branded-Proposal quote with a
   real computed total, or save a computed Cost Estimate document straight onto the
   project.
5. Every meaningful write (login, template edit, quote generated, cost estimate saved,
   diagram saved, file uploaded, user invited, etc.) writes a real row to Audit Logs —
   nothing there is static seed data.

## Status: what's real vs. not yet

Built and verified end-to-end (tested against the actual running backend, not just UI):
templates, document/quote export (Word + PDF + branded Proposal), rendered Preview
before export, document review/approval workflow (Draft → In Review → Approved, with
request-changes notes and auto-revert on edit), Service Catalog + cart + quote
generation + package creation, Knowledge Base upload/download/delete, Settings (org
info + API key rotation, masked), Users (real invite issuing a login-capable account),
role-based access control, Connectors (reflects and manages real Claude Code MCP
servers), audit logging, AI Chat (real multi-turn conversation via the same
Bedrock/Claude CLI provider selected in Settings), architecture diagram generation
(AI-drafted via draw.io embed, hand-editable, embeds as a real image in Word/PDF
exports, with insert-under-a-specific-heading support), Service Catalog quotes linked
back to a Project (from anywhere, not just the project page), a Cost Estimator that
computes a real Markdown table from actual Service Catalog pricing and attaches it to
the project as an editable Document, and AI Chat → Project hand-off (AI summarizes the
conversation, architect reviews/edits before the project is actually created). Backend
(pytest) and frontend (Vitest) automated test suites exist, gated by a GitHub Actions
CI pipeline (lint + test + build) on every push/PR to `main`.

**Not yet real:**
- Chat conversations aren't persisted server-side — refreshing `/chat` loses the
  conversation, so **Create Project from this Chat** only works within the same browser
  session.
- A project's Cost Estimate is a single document that gets overwritten on regeneration —
  unlike Quotes (one row kept per generation), there's no history of past estimates.
- Frontend test coverage is minimal (`lib/api.ts`'s request/error handling only) — most
  page/component logic is untested; the CI gate is lint + build + that small unit suite,
  not full UI coverage.

## Local Development

```bash
# Backend
cd backend
python -m venv venv && source venv/Scripts/activate   # Windows Git Bash
pip install -r requirements.txt
python -m app.seed          # creates sagenerator.db and seeds demo data
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                 # http://localhost:3000
```

Default login: `admin` / `admin123` (set in `backend/.env` — change before any shared
use; see `backend/.env.example`-style comments in `backend/.env` for the AI provider
and Claude CLI options).

**Tests** — `cd backend && pytest` (spins up its own throwaway SQLite DB, no setup
needed) and `cd frontend && npm test` (Vitest). Both run in CI on every push/PR to
`main` (`.github/workflows/ci.yml`), alongside `npm run lint` and `npm run build`. See
[`docs/testing.md`](docs/testing.md) for what's covered, how the fixtures/mocking work,
and how to add new tests.

**Before production:** rotate the admin password, switch to Postgres, and put this
behind HTTPS (`JWT_SECRET` is already a random secret and `/api/auth/login` already
rate-limits repeated failures — see `backend/app/rate_limit.py`). See the Status section
above for feature gaps.
