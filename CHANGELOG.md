# Changelog

A running log of features and notable changes to CloudSolution Hub, newest first.
Update this file whenever a feature is added, changed, or removed — it's the
one place to check "what exists and when did it show up" without digging
through commit history.

## Unreleased

## 2026-08-14 — Reorganized docs/ into deployment / development / how-to-use

`docs/ec2/` mixed Terraform, the deploy script, and the deploy guide with no clear home
for anything else, and `PROJECT_DOCUMENTATION.md` was the only architecture reference —
no separation between "how do I ship this" and "how does this actually work."

- `docs/ec2/` → `docs/deployment/` (Terraform, `sagen.sh`, `deploy-aws.md`).
- `docs/PROJECT_DOCUMENTATION.md` → `docs/development/project-documentation.md`;
  `docs/testing.md` → `docs/development/testing.md`.
- New `docs/how-to-use/` — empty for now, scaffolded for an end-user guide.
- All `.md` filenames lowercased (`deploy_aws.md` → `deploy-aws.md`, etc.) for a
  consistent naming convention across `docs/`.

## 2026-08-14 — Database migrations via Alembic

Every schema change up to now was a hand-written `ALTER TABLE` run manually over SSH —
fragile, and easy to forget on one environment while remembering it on another (this bit
us twice in one session: the `bedrock_api_key` widening, then the `solution_packages`
`assumptions` column).

- Added Alembic, configured to read the app's own `DATABASE_URL` (no second URL to keep
  in sync) and to run in batch mode so SQLite (dev) and Postgres (prod) share one
  migration file without branching logic.
- Generated and applied a baseline migration that brings the local dev DB fully back in
  sync with the current models.
- `docs/deployment/sagen.sh deploy` now runs `alembic upgrade head` automatically —
  shipping a schema change is `git push` + `sagen.sh deploy` like any other change, no
  manual SQL.
- Documented the one-time bootstrap `docs/deployment/deploy-aws.md` needs for the
  existing EC2 instance, which predates Alembic.

## 2026-08-14 — Role-based sidebar access control and Solution Packages

- New `RolePermission` system: custom roles (e.g. a "Sales" role) get a configurable
  subset of the sidebar, managed via Users → Manage Roles. The four built-in roles
  (Owner/Architect/Reviewer/Viewer) keep full access automatically, and newly-shipped
  nav modules backfill into them so an Owner doesn't have to remember to grant access.
- New Solution Packages: named use-case bundles (outcome, assumptions, services,
  reference architecture, pricing note) distinct from Service Catalog's generic sizing
  tiers. Nested sidebar tree, a detail page per solution, and Word/PDF export.
- Re-scoped Service Catalog's Basic/Intermediate/Advanced tiers around migration
  packaging, and seeded example solution packages (SAP Migration, DR, VDI Rollout, and
  Migration-Basic/Intermediate/Advanced sized at 5/10/20 VMs).
- Fixed an antd v5 / React 19 compatibility warning via Ant Design's official patch.

## 2026-08-06 — Word upload now preserves headings, bold text, and tables

`extract_docx_text` used to be `document.paragraphs` joined with blank lines — plain
text only. Headings were indistinguishable from body text, bold/italic formatting was
stripped, and tables weren't even read (`document.paragraphs` excludes them entirely, so
a table's content just vanished with no error and no trace). Verified against a real
276-paragraph, 18-table company Statement of Work template — previously all 18 tables
disappeared silently.

- Replaced the hand-rolled extraction with `mammoth` (.docx → HTML, actually understands
  Word's structure) → `markdownify` (HTML → our markdown syntax), instead of re-inventing
  that understanding ourselves.
- Embedded images are stripped rather than kept as inline base64 — a handful of images
  can otherwise bloat a converted document from ~30KB to 1MB+, which both makes the raw
  editor unreadable and blows past reasonable limits the moment "Ask AI" sends the whole
  document as context.
- Fixed a Mammoth quirk found along the way: it never marks any table row as a header
  (plain `<td>` even for visually-bold header rows), so `markdownify` fabricated an empty
  header row to satisfy markdown's table syntax, pushing the real header into the first
  data row. Now the first row of each table is promoted to a real header before
  conversion.
- New dependencies: `mammoth`, `markdownify`, `beautifulsoup4` (all pure Python, no
  system-level dependencies — safe to add without touching the EC2 setup docs).

## 2026-08-06 — Fixed New Template's "Starting Content" upload crashing on bad files

- **Root cause**: `create_template`'s file-to-text extraction only caught `ValueError`
  (raised for genuinely unsupported extensions like `.doc`) but not the exceptions
  `python-docx` raises for a `.docx` that isn't actually a valid OOXML package — a
  renamed `.doc`, a corrupted upload, anything malformed — which crashed with an
  unhandled 500 instead of a clean error.
- Broadened the exception handling to catch any extraction failure and return a clean
  400 with an actionable message ("re-save it as .docx and try again, or leave the
  upload empty").
- The New Template modal's file picker also advertised `.doc` as accepted
  (`accept=".pdf,.doc,.docx,.md,.txt"`), which could never work — there's no `.doc`
  parser anywhere in this codebase, only `.docx`/`.pdf`/`.md`/`.txt`. Removed `.doc` from
  the accepted types and said so explicitly in the hint text, rather than advertising
  support that silently failed. (Knowledge Base and Project source-document uploads are
  unaffected — those just store the file for later download, they never parse it, so
  `.doc` genuinely works there.)

## 2026-08-06 — Forced password rotation on first login; a global search bar

- **Forced password change**: `admin`/`admin123` (and any account an Owner invites or
  resets) now sits behind a `must_change_password` flag — a blocking modal appears on
  next login until the account holder sets their own password via a new self-service
  `POST /api/auth/change-password` endpoint (previously the only password-changing
  endpoint was Owner-resets-someone-else; there was no way for a user to change their
  own password at all). Existing users get flagged retroactively by the migration
  itself (`ALTER TABLE ... DEFAULT true` backfills existing rows on Postgres).
- **Global search**: a search bar in the header (`GET /api/search?q=`) finds matches
  across Projects, Documents, Templates, and Knowledge Base by name/title, grouped by
  category, two or more characters, debounced. Previously the only way to find anything
  was browsing to the right nav item and scanning its list.
- Fixed the header's hardcoded "admin" label while touching this file — it now shows the
  real logged-in user's name, same fix already applied to the Dashboard and AI Chat.

## 2026-08-06 — Dashboard: replaced two fake stats with real ones, added a review panel

- **"AI Requests This Month: 1,284" and "Est. Monthly AI Cost: $253.30" were hardcoded
  constants** never computed from anything — removed. Replaced with **Pending Review**
  (count of documents with status `In Review`) and **Quotes Generated** (real count from
  a new `GET /api/service-catalog/quotes` endpoint, filtered to the current month).
- New **Needs Your Review** panel lists documents actually awaiting review with a direct
  link, rather than leaving the count as a number nobody can act on from the dashboard.
- **"Welcome back, admin"** was hardcoded regardless of who logged in — now a real
  time-of-day greeting using the current user's name (`getCurrentUser()`), via a small
  shared `lib/greeting.ts` also used by the AI Chat page's empty-state greeting.
- Found along the way: quotes are only persisted when generated with a `projectId` — a
  standalone quote is generated and downloaded but never written to the `quotes` table.
  `GET /api/service-catalog/quotes` necessarily only reflects project-linked quotes for
  the same reason `GET /api/projects/{id}/quotes` always has.

## 2026-08-06 — Consolidated deploy docs into docs/ec2/; added a service-control script

- Moved `main.tf`, `.terraform.lock.hcl`, and `deploy_aws.md` into a new `docs/ec2/`
  folder instead of leaving them scattered directly under `docs/` alongside the
  general-purpose `testing.md`.
- Added `docs/ec2/sagen.sh`: `start` / `stop` / `restart` / `status` / `logs` / `deploy`
  subcommands wrapping the systemd + rebuild steps documented in `deploy_aws.md` —
  `deploy` alone does `git pull` → reinstall backend deps → rebuild frontend → restart
  both services → health-check both, replacing a sequence that had been typed by hand
  over SSH repeatedly.
- `deploy_aws.md` now states the Claude CLI provider's prerequisite explicitly: the CLI
  and its login have to exist **on the EC2 instance**, not the operator's laptop, and
  Settings → AI Provider → Test Connection is how you confirm that rather than assume it.

## 2026-08-06 — Removed LiteLLM/boto3; AWS Bedrock now calls the API directly

- **Dropped `litellm` and `boto3` as dependencies entirely.** Bedrock was previously
  reached through `litellm.completion(model="bedrock/...")`, which required `boto3` and
  AWS SigV4 request signing (an Access Key ID + Secret Access Key pair) — and `boto3`
  turned out to not even be installed, so every Bedrock call was failing with
  `ImportError: Missing boto3 to call bedrock`. AWS now offers **Bedrock API keys** (a
  bearer token, generated from the Bedrock console), which the Bedrock Runtime Converse
  API accepts directly over plain HTTPS — no SDK, no signing. `ai_assist.py` now calls it
  with a plain `httpx.post(...)` and an `Authorization: Bearer <key>` header.
  - Settings → AI Provider now offers **Claude CLI** or **AWS Bedrock** only — the
    "LiteLLM (API key or Ollama)" option is gone. Its underlying `litellm_proxy_key`
    field was never actually wired to anything real anyway (a bug fixed and then made
    moot in the same day — see below).
  - Bedrock credentials in Settings are now a single **API Key** field instead of
    separate Access Key ID + Secret Access Key fields.
  - `AppSettings.bedrock_access_key_id` / `bedrock_secret_access_key` / `litellm_proxy_key`
    columns are gone, replaced by a single `bedrock_api_key` column — existing rows need
    a fresh `drop_all`/`create_all` (or equivalent migration) to pick up the new schema.
- Every AI-calling router (`chat`, `diagrams`, `documents`, `projects`, `templates`) now
  builds an `AiConfig` (via a shared `get_ai_config(db)` helper in `routers/settings.py`)
  instead of passing a bare `provider` string — Bedrock's API key/region/model travel
  with it, since there's no longer an env var for `ai_assist.py` to read them from.

## 2026-08-05 — First live deployment; Capability.id column-width fix

- **Deployed to AWS**: CloudSolution Hub is now running on the EC2 instance provisioned
  by `docs/main.tf` (Ubuntu 24.04, Postgres, nginx reverse proxy), reachable at its
  Elastic IP over plain HTTP. Backend and frontend each run under their own systemd unit
  (`sagen-backend`, `sagen-frontend`), both bound to `127.0.0.1` with nginx as the only
  thing exposed publicly.
- **Fixed `Capability.id` (`backend/app/models.py`)**: was `String(32)`, too narrow for
  `seed.py`'s longer human-readable capability slugs (e.g.
  `cap-kubernetes-container-platforms`, 35 chars). Never surfaced locally because SQLite
  doesn't enforce `VARCHAR` length — only broke once seeding against real Postgres.
  Widened to `String(64)`.
- **`docs/main.tf` / `docs/deploy_aws.md` corrected from what the live deploy actually
  needed**: Ubuntu's own `nodejs` apt package is v18, too old for `@tailwindcss/oxide`
  (needs Node >= 20) and fails the frontend build with a "Cannot find native binding"
  error — `user_data` now installs Node 20 via NodeSource instead. Also added a 2GB
  swapfile: t4g.micro/t3.micro's 1GB RAM isn't enough headroom for `next build`, which
  was getting OOM-killed. Systemd unit templates in `docs/deploy_aws.md` now include
  `User=ubuntu` (the original templates had no `User=`, meaning both processes would
  otherwise run as root).

## 2026-08-05 — AWS Bedrock as an AI provider; frontend moved into frontend/

- **AWS Bedrock**: Settings now has a third AI provider option alongside LiteLLM and
  Claude CLI. Implemented without duplicating any of the four AI capabilities
  (drafting, chat, diagrams, chat→project extraction) — Bedrock is just another
  `litellm.completion()` model string (`bedrock/...`, via `BEDROCK_MODEL` in
  `backend/.env`) sharing the existing LiteLLM call path through a new
  `_resolve_model(provider)` helper. No stored API key for it — auth comes from the
  backend's AWS credentials or, recommended, an IAM role on the EC2 instance.
- **Repo structure**: the frontend (`app/`, `components/`, `lib/`, and all its config)
  moved from the repo root into its own `frontend/` folder, matching how `backend/`
  already worked — each half is now unambiguous to identify and run independently.
  Pure move, zero source changes: the `@/*` path alias resolves relative to wherever
  `tsconfig.json` lives, so it kept working with no import edits anywhere. Updated:
  `.github/workflows/ci.yml` (frontend job now has `working-directory: frontend`,
  matching the backend job), `README.md`, `docs/deploy_aws.md`, `docs/testing.md`.

## 2026-08-04 — Backup docs now cover uploads/, not just the database

`docs/deploy_aws.md`'s backup guidance only ever mentioned backing up the database
(SQLite file or `pg_dump`) — `backend/uploads/` (exported diagram PNGs, Knowledge Base
files, project source-document uploads) lived on the same EBS volume but was never
actually named as something to back up. Added a dedicated **Backups** section covering
both together, with a sample cron job, and updated the pre-deploy checklist to match.

## 2026-08-04 — Rename to CloudSolution Hub; testing guide

- Renamed the app from SA Generator to **CloudSolution Hub** — display branding only
  (README/CHANGELOG titles, `package.json` name, in-app UI text, FastAPI/OpenAPI title,
  the AI chat system prompt's self-description). The GitHub repo, local folder, and
  deployment-doc directory/service names were left as-is intentionally — those are
  infrastructure identifiers, not display branding.
- New `docs/testing.md` — the actual testing guide the README's 3-line blurb pointed at
  but didn't have: what each backend/frontend test file covers, how the pytest
  fixtures and DB isolation work, the "patch where it's used, not where it's defined"
  mocking gotcha this codebase already hit once, and how to add new tests.

## 2026-08-03 — Tests/CI, diagram insert-at-heading, Cost Estimator, Chat → Project

Closed all five gaps that were sitting in README's "Not yet real" section.

**Tests + CI**
- Backend: `pytest` + `httpx`, isolated per-run SQLite (`DATABASE_URL` set before
  `app.main` import), unit tests for `document_export`/`auth`/`rate_limit`/`ai_assist`
  (LLM calls mocked, never hit a real provider), integration smoke tests via
  `TestClient` (auth, RBAC, the various round trips added below).
- Frontend: Vitest, unit tests for `lib/api.ts`'s `apiFetch`/`postForm` error handling.
- First-ever `npm run lint` run surfaced ESLint had never actually been configured in
  this repo — added the flat config and fixed the two pre-existing errors it found.
- New `.github/workflows/ci.yml`: backend (`pytest`) + frontend (lint, test, build) on
  every push/PR to `main`.

**Diagram insert-at-heading**
- **Insert into document** can now target a specific existing heading instead of always
  appending to the end; re-inserting under a different heading moves the image rather
  than leaving a duplicate.

**Standalone quotes → project linking**
- The **Link to Project** selector on `/service-catalog` now works whether you arrived
  via a project's **Generate Quote** button or navigated there directly — previously
  only the former could link a quote back to a project.

**Cost Estimator**
- New `build_cost_estimate_markdown()` computes a real Markdown table straight from
  selected Service Catalog packages' actual pricing (not AI-guessed numbers).
  **Save as Cost Estimate Document** (`POST /api/projects/{id}/cost-estimate`) upserts
  it as a real `GeneratedDocument` on the project — regenerating updates the same
  document instead of duplicating it — so it gets the normal Preview/AI-assist/
  review/export pipeline for free.

**AI Chat → Project**
- `extract_project_from_chat()` (first structured-JSON-output usage in this codebase,
  following the same prompt-then-parse-then-validate pattern already proven by the
  diagram XML generator) summarizes a chat conversation into a name/customer/cloud/
  description. **Create Project from this Chat** on `/chat` calls it and opens
  `NewProjectModal` pre-filled with the result — the architect still reviews/edits
  before anything is created; no auto-creation, no chat persistence added.

## 2026-08-03 — Architecture diagram automation + Service Catalog linking

**Architecture diagrams**
- New **Diagram** button on the document editor opens an embedded draw.io
  (diagrams.net) canvas per document.
- **Ask AI to draft** generates a starting diagram via the same AI provider
  used elsewhere (LiteLLM or local `claude -p`), picking real AWS/Azure/GCP
  icon stencils based on the project's cloud.
- Diagrams are hand-editable, not just AI output — save persists the mxGraph
  XML; **Insert into document** exports a PNG and embeds it in the document's
  Markdown at a stable per-document URL.
- Word and PDF export now render that embedded image as a real picture
  (`document_export.py` gained `resolve_image` support in both the
  `python-docx` and `reportlab` paths — previously images weren't supported
  at all).
- New model: `DocumentDiagram` (one row per document — xml + rendered PNG
  path). New router: `backend/app/routers/diagrams.py`.

**Service Catalog**
- Quotes generated from `/service-catalog` can now optionally be linked to a
  Project (`projectId` on `QuoteRequest`) — persisted as a new `Quote` model
  and shown in a **Quotes** table on the project detail page. Previously
  quotes were entirely disconnected from Projects (typed customer name only,
  nothing saved).
- **New Package** button + modal — Service Catalog previously only supported
  editing existing Tiers/Container Services/Add-Ons, not creating new ones.

## Baseline (repo init)

Everything present when this repo was first committed to git — see
`README.md` for the full breakdown. In short: Projects, Documents (with
AI-assist drafting, Draft → In Review → Approved workflow, Word/PDF/Markdown
export), Templates, Service Catalog (browse/edit/quote, no create yet),
Knowledge Base, Users/RBAC, Audit Logs, Settings, AI Chat, MCP Connectors.
