# Changelog

A running log of features and notable changes to SA Generator, newest first.
Update this file whenever a feature is added, changed, or removed — it's the
one place to check "what exists and when did it show up" without digging
through commit history.

## Unreleased

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
