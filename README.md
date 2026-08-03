# SA Generator

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
- Routes AI drafting through a swappable backend (hosted LLM via LiteLLM, or a local
  Claude Code CLI subprocess) so it isn't locked to one provider

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
any normal draw.io diagram, **Save** to persist it, then **Insert into document** to drop
it into the Markdown as an image (it lands at the end of the content — move the line
manually if you want it under a specific heading). Word/PDF export renders it as a real
embedded picture, not a broken link.

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

**7. Build a quote** — Service Catalog → click a tier/add-on card for full resource
details, **Add to Cart** the ones a customer wants, optionally **Compare** a couple side
by side, then fill in Customer Name + Description and generate a Word/PDF/branded
Proposal with a real computed total. Use **New Package** to add a new Tier/Container/
Add-On to the catalog (previously only editing existing ones was possible). Starting a
quote from a project's **Generate Quote** button pre-fills the customer name and saves
the quote to that project's **Quotes** table; quotes generated directly from
`/service-catalog` are still one-off and not linked to anything.

**8. Scope with AI Chat** — `/chat` is a real multi-turn conversation (via whichever AI
provider is selected in Settings) for talking through a solution before committing to a
project. It's discussion-only — it doesn't create a project or document for you, so once
you know what you need, go create the project from a matching template (step 2).

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

**AI** — [LiteLLM](https://github.com/BerriAI/litellm) (provider-agnostic — OpenAI,
Anthropic, Bedrock, Ollama, etc. via `LITELLM_MODEL` + a provider key) **or** a local
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
  ├── litellm.completion() ──▶ hosted LLM provider          (AI Assistant: litellm mode)
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
2. Pick a Template or Document, optionally ask the AI Assistant to draft a section
   (routed through LiteLLM or the local Claude CLI, whichever Settings selects), add an
   AI-drafted/hand-edited architecture diagram → export to Word or PDF.
3. Or: build a quote in the Service Catalog — add tiers/add-ons to the cart, fill in
   customer name + description, generate a Word/PDF/branded-Proposal quote with a
   real computed total, optionally linked back to a Project.
4. Every meaningful write (login, template edit, quote generated, diagram saved, file
   uploaded, user invited, etc.) writes a real row to Audit Logs — nothing there is
   static seed data.

## Status: what's real vs. not yet

Built and verified end-to-end (tested against the actual running backend, not just UI):
templates, document/quote export (Word + PDF + branded Proposal), rendered Preview
before export, document review/approval workflow (Draft → In Review → Approved, with
request-changes notes and auto-revert on edit), Service Catalog + cart + quote
generation + package creation, Knowledge Base upload/download/delete, Settings (org
info + API key rotation, masked), Users (real invite issuing a login-capable account),
role-based access control, Connectors (reflects and manages real Claude Code MCP
servers), audit logging, AI Chat (real multi-turn conversation via the same
LiteLLM/Claude CLI provider selected in Settings), architecture diagram generation
(AI-drafted via draw.io embed, hand-editable, embeds as a real image in Word/PDF
exports), and Service Catalog quotes linked back to a Project.

**Not yet real:**
- No pipeline connects Projects → AI Chat → generated Documents. AI Chat is
  conversational only — it doesn't turn a conversation into a project or document yet;
  that still requires creating a project from a template. Templates and Documents are
  now chained to Diagrams and (optionally) Service Catalog quotes, but Projects → AI
  Chat is still disconnected.
- No automated Cost Estimator beyond the fixed Service Catalog pricing.
- Inserting a diagram into a document always appends it at the end of the content —
  there's no "insert at cursor" or "insert under this heading."
- Quotes generated directly from `/service-catalog` (not opened via a project's
  **Generate Quote** button) still aren't linked to any project.
- No automated tests and no CI pipeline exist in this repo yet.

## Local Development

```bash
# Backend
cd backend
python -m venv venv && source venv/Scripts/activate   # Windows Git Bash
pip install -r requirements.txt
python -m app.seed          # creates sagenerator.db and seeds demo data
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
npm install
npm run dev                 # http://localhost:3000
```

Default login: `admin` / `admin123` (set in `backend/.env` — change before any shared
use; see `backend/.env.example`-style comments in `backend/.env` for the AI provider
and Claude CLI options).

**Before production:** rotate the admin password, switch to Postgres, and put this
behind HTTPS (`JWT_SECRET` is already a random secret and `/api/auth/login` already
rate-limits repeated failures — see `backend/app/rate_limit.py`). See the Status section
above for feature gaps.
