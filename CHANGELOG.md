# Changelog

A running log of features and notable changes to SA Generator, newest first.
Update this file whenever a feature is added, changed, or removed — it's the
one place to check "what exists and when did it show up" without digging
through commit history.

## Unreleased

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
