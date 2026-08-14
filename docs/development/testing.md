# Testing Guide

What exists, how it's organized, how to run it, and how to extend it. Companion to
`README.md`'s one-line summary and `.github/workflows/ci.yml`, which is the authoritative
source for exactly what gates a push/PR to `main`.

## Quick start

```bash
# Backend — from backend/, with the venv activated
cd backend
source venv/Scripts/activate   # Windows Git Bash
pytest -v

# Frontend — from frontend/
cd frontend
npm test
```

Neither needs any setup beyond what Local Development in `README.md` already has you do
(`pip install -r requirements.txt`, `npm install`). The backend suite creates its own
throwaway SQLite database per run — it never touches `backend/sagenerator.db`.

## Backend (`backend/tests/`, pytest)

### How isolation works — `conftest.py`

`app/main.py` runs `Base.metadata.create_all(bind=engine)` at **module import time**, so
the test DB has to exist before `app.main` (or anything that imports it) is ever
imported. `conftest.py` handles this at the top of the file, before any `app.*` import:

```python
_db_fd, _db_path = tempfile.mkstemp(suffix=".db")
os.environ["DATABASE_URL"] = f"sqlite:///{_db_path}"
os.environ.setdefault("JWT_SECRET", "test-secret-do-not-use-in-prod")
```

The temp file is removed at process exit (`atexit`, with a Windows-specific
`try/except OSError` since the SQLite engine can still hold the file handle at
interpreter shutdown — harmless, it's in the OS temp dir either way).

**Fixtures available to every test:**

| Fixture | Gives you |
|---|---|
| `client` | A plain `TestClient(app)` — no auth cookie set |
| `db_session` | A raw SQLAlchemy session against the test DB, for inserting fixture rows directly (e.g. a `Project`) without going through an API endpoint |
| `make_user(role="Owner", password="testpass123")` | Factory — creates a `User` row with a real bcrypt-hashed password, returns `(User, plaintext_password)`. Call it multiple times per test for different roles. |
| `auth_client` | A `TestClient` already logged in as a fresh Owner user (calls `make_user` + `POST /api/auth/login` for you) — the common case, since most endpoints require auth |

There's no per-test transaction rollback — tests share one DB file for the whole run.
This is fine in practice because fixtures use `uuid4()`-based IDs/usernames, so tests
don't collide with each other. If you write a test that depends on the DB being *empty*
(e.g. counting all rows of something), it will not be isolated from other tests — query
by the specific IDs/names your test created instead.

### Mocking AI calls — never hits a real provider

`ai_assist.py` has two provider paths — Bedrock (a direct HTTPS call via `httpx.post`) and
Claude CLI (a `subprocess.run` call) — and tests never let either touch the real world.
For Bedrock-path tests, patch the shared `_bedrock_converse` helper so nothing below it
(not even `httpx`) gets exercised:

```python
monkeypatch.setattr(ai_assist, "_bedrock_converse", lambda config, system, messages: json.dumps(payload))
```

For Claude CLI-path tests, patch `subprocess.run` and `resolve_claude_binary` instead —
see `TestClaudeCliDispatch` in `test_ai_assist.py`. `TestBedrockConverse` in the same file
goes one level deeper and mocks `ai_assist.httpx.post` itself, to verify the actual request
shape (bearer token in the `Authorization` header, model ID in the URL, etc.) without a
real network call.

**Gotcha this codebase has already hit once:** if you're testing a *router* that calls an
`ai_assist.py` function via `from app.ai_assist import some_function`, patching
`ai_assist.some_function` does **not** affect the router — Python bound that name into the
router module's own namespace at import time. Patch it where it's *used*:

```python
from app.routers import chat as chat_router
monkeypatch.setattr(chat_router, "extract_project_from_chat", lambda messages, config: extracted)
```

`test_api_smoke.py::TestChatExtractProject` demonstrates this — it patches the router's
imported name rather than `ai_assist.extract_project_from_chat` directly.

### What's covered, file by file

**`test_auth.py`** — pure logic, no DB: bcrypt hash/verify roundtrip, JWT
create/decode roundtrip, tampered and garbage tokens correctly rejected with 401.

**`test_rate_limit.py`** — pure in-memory logic (no DB, no HTTP): the login-lockout
window (`MAX_ATTEMPTS`, `WINDOW_SECONDS`) — allowed below the threshold, locked at it,
`reset()` clears it. Each test uses a fresh random key so tests don't interfere with each
other via the module-level `_attempts` dict.

**`test_document_export.py`** — pure Markdown/PDF/DOCX generation logic:
- `parse_monthly_price` edge cases (commas, decimals, no digits, empty string)
- `_bold_to_reportlab` / `_esc` — the reportlab mini-XML escaping helpers
- `markdown_to_docx` / `markdown_to_pdf` — headings, tables, checkboxes, code blocks, and
  the image-embedding path (both with and without a `resolve_image` callback, confirming
  the fallback-to-literal-text behavior when no resolver is given)
- `build_cost_estimate_markdown` — total computed correctly across multiple packages,
  resource table rows render, empty package list produces a `$0.00/mo` total

**`test_ai_assist.py`** — `TestBedrockConverse` covers the direct-HTTP Bedrock path itself
(bearer token header, model-in-URL, missing-key and non-200-response error messages).
`extract_project_from_chat` and `draft_diagram_xml` are tested with `_bedrock_converse`
mocked: valid JSON/XML parses through correctly, markdown code fences around the response
get stripped, missing JSON fields fall back to empty strings rather than crashing, and
invalid JSON/XML raises `RuntimeError` (which routers turn into a 502).
`TestClaudeCliDispatch` confirms the default provider never touches the network.

**`test_api_smoke.py`** — integration tests via `TestClient`, organized by concern:
- `TestHealth` / `TestAuthRequired` — `/api/health` needs no auth, `/api/projects` and
  `/api/service-catalog` do
- `TestLoginLockout` — 11 wrong-password attempts in a row trips the 429
- `TestRoleEnforcement` — a Viewer can't create a Service Catalog package (403), an
  Owner can (201)
- `TestQuoteProjectLinking` — generating a quote with a `projectId` shows up in that
  project's `GET /quotes`; an invalid `projectId` 404s *and confirms nothing got logged*
  (this test exists because that was a real bug caught during development — the audit log
  entry was originally written before the project-existence check)
- `TestCostEstimate` — generating twice updates the same `GeneratedDocument` instead of
  duplicating it (checked by querying the DB directly, not just the API response), an
  empty `packageIds` 400s, a Viewer gets 403
- `TestChatExtractProject` — the extraction endpoint returns what the (mocked) AI
  extracted, an empty `messages` list 400s, an AI `RuntimeError` surfaces as a 502

## Frontend (`lib/api.test.ts`, Vitest)

**Scope is intentionally narrow right now**: `apiFetch` and `postForm` (indirectly, via
`uploadKnowledgeDoc`) in `lib/api.ts` — the two functions every single API call in the
app funnels through. Covered: successful JSON parsing, the default `Content-Type: application/json`
header (and that it's overridable), `ApiError` thrown with the backend's `detail` message
on failure, falling back to a generic message when the error body isn't valid JSON, and
confirming `postForm` deliberately does *not* set a `Content-Type` header (so the browser
sets the multipart boundary itself).

**Not covered — a real, known gap** (also called out in `README.md`'s Status section):
no component or page-level tests exist. Nothing renders a React component, clicks a
button, or checks what ends up on screen. `npm run build` (which runs `tsc` and Next's
static generation) is the closest thing to a regression check most pages get today.

Config: `vitest.config.mts` — `environment: "node"` (no `jsdom`, since nothing renders
DOM), includes any `**/*.test.ts` outside `node_modules`/`.next`/`backend`.

## CI — `.github/workflows/ci.yml`

Two independent jobs, both on push and PR to `main`:

- **`backend`** — Python 3.12 (matches `backend/venv/pyvenv.cfg`), `pip install -r
  requirements.txt`, `pytest -v`.
- **`frontend`** — Node 20 LTS, `npm ci`, `npm run lint`, `npm test`, `npm run build`
  (build doubles as the type-check gate, since `next build` runs `tsc`).

Either job failing blocks the merge (if branch protection is turned on for `main` — the
workflow itself doesn't enforce that, GitHub repo settings do).

## Adding a new test

**Backend**: new logic in an existing module → add a test class to the matching
`test_*.py` file (e.g. a new `document_export.py` function goes in
`test_document_export.py`). New router/endpoint → add to `test_api_smoke.py`, using
`auth_client` unless you're specifically testing an unauthenticated or role-restricted
path. If it touches `ai_assist.py`, mock `_bedrock_converse` (Bedrock path) or
`subprocess.run` (Claude CLI path) — or the imported name in whichever router calls it —
never let a test make a real network call to an LLM provider.

**Frontend**: co-locate `*.test.ts` next to the file it tests (matches `lib/api.test.ts`
sitting next to `lib/api.ts`). Mock `global.fetch` with `vi.stubGlobal`/`vi.fn()` rather
than hitting a real backend — see `lib/api.test.ts`'s `mockFetchOnce` helper.
