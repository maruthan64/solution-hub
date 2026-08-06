# Changelog

A running log of features and notable changes to CloudSolution Hub, newest first.
Update this file whenever a feature is added, changed, or removed — it's the
one place to check "what exists and when did it show up" without digging
through commit history.

## Unreleased

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
