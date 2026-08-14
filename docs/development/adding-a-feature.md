# Adding a New Feature

The actual process, as followed for every feature added this project — role-based access
control, Solution Packages, the Service Catalog migration tiers, Alembic. Not a
hypothetical process, this is what's been done repeatedly and works.

Assumes local setup is already done — see **Local Development** in `README.md`.

## 1. Backend

Work through these in order; each depends on the one before it.

1. **Model** — add or change a SQLAlchemy model in `backend/app/models.py`. Follow the
   existing style: `Mapped[...]` typed columns, a short docstring on the class explaining
   *why* it exists if the name alone doesn't make it obvious (see `SolutionPackage` for
   an example — it exists specifically to explain how it differs from `ServicePackage`).
2. **Schema** — add Pydantic `...Out` / `...Create` / `...Update` classes in
   `backend/app/schemas.py`. `Update` can usually just subclass `Create` if the fields are
   identical (see `SolutionPackageUpdate`).
3. **Router** — new feature usually means a new file in `backend/app/routers/`. Copy the
   shape of an existing one close to what you're building (`capabilities.py` and
   `solution_packages.py` are both good templates: a `to_out()` mapper, `list`/`get` under
   `require_user`, `post`/`put`/`delete` under `require_role("Owner", "Architect")`).
4. **Wire it in** — import the router in `backend/app/main.py` and
   `app.include_router(...)`. If it's a new top-level sidebar page, also add its path to
   `ALL_MODULES` in `backend/app/routers/role_permissions.py` — new modules backfill into
   the built-in roles automatically on next startup, so nothing else is needed for
   Owner/Architect/Reviewer/Viewer to see it. Custom roles (anything created via
   Users → Manage Roles) do **not** auto-gain new modules — that's deliberate, an Owner
   grants access explicitly.
5. **Migration** — any model change needs a migration:
   ```bash
   cd backend && source venv/Scripts/activate   # venv/bin/activate on the EC2 instance
   alembic revision --autogenerate -m "add X to Y"
   # read the generated file in alembic/versions/ before trusting it — autogenerate
   # is a starting point, not a guarantee, especially for renames
   alembic upgrade head
   ```
   Commit the generated migration file alongside the model change. See
   `docs/deployment/deploy-aws.md` → **Database migrations (Alembic)** for how this
   applies on deploy.
6. **Tests** — new file in `backend/tests/test_<feature>.py`. See
   `docs/development/testing.md` for the fixtures available (`auth_client`, `make_user`,
   etc.) and how test isolation works. At minimum, cover: auth required, role required for
   writes, the CRUD happy path, and a 404 for a nonexistent ID.
7. **Seed data** (optional) — if the feature needs example content to not look empty on
   first load, add it to the relevant `if db.query(Model).count() == 0:` block in
   `backend/app/seed.py`. This only runs against an empty table, so re-running
   `python -m app.seed` is always safe on a populated DB.

## 2. Frontend

1. **Types** — add the shape to `frontend/lib/types.ts`.
2. **API functions** — add fetch wrappers to `frontend/lib/api.ts`, matching the naming
   pattern already there (`getX`, `createX`, `updateX`, `deleteX`).
3. **Nav entry** (if it's a new top-level page) — add to `frontend/lib/nav.ts`. Nothing
   else needed; `AppShell.tsx` filters the sidebar by the current user's role
   automatically.
4. **Pages** — `frontend/app/(app)/<feature>/page.tsx` for a list view,
   `frontend/app/(app)/<feature>/[id]/page.tsx` for a detail view if the feature needs
   one. `capabilities/page.tsx` (card grid + modal) and `solution-packages/` (list +
   dedicated detail page) are the two established shapes — pick whichever fits.

## 3. Verify before shipping

```bash
# Backend
cd backend && pytest -v

# Frontend
cd frontend
npx tsc --noEmit
npm run lint
npm test
```

**Don't run `npm run build` while a dev server is already running against the same
`.next` directory** — the production build clobbers the dev server's cache mid-flight and
corrupts it. Only build in CI, or after stopping the local dev server.

If you can, actually click through the feature in a browser rather than trusting the
checks alone — several bugs this session (a route-shadowing issue, a stale font/cache
problem) only showed up that way.

## 4. Ship it

- `git add` the specific files that belong to the change — not `-A`. Review `git status`
  before committing; it's easy to accidentally sweep up an unrelated file sitting in the
  working tree.
- Commit with a message that explains *why*, not just what changed.
- `git push origin main` — there's no branch/PR flow on this repo currently; everything
  ships directly to `main`. `.github/workflows/ci.yml` runs the same pytest/lint/test/build
  checks on every push as a safety net, but nothing blocks the push itself.
- Deploy: `bash docs/deployment/sagen.sh deploy` run over SSH on the EC2 instance — pulls,
  reinstalls deps, applies migrations, rebuilds the frontend, restarts both services,
  health-checks. One command, covers both code and schema.
- Add a dated entry to `CHANGELOG.md` — what changed and why, one entry per feature.

## What's deliberately missing from this process

No staging environment, no PR review, no feature flags, no branch protection. This is a
small internal tool with one active developer — that overhead would slow things down
without buying much safety at this scale. Reconsider if the team or the app's blast
radius grows past what this comfortably covers (see **When you outgrow this** in
`docs/deployment/deploy-aws.md` for the equivalent judgment call on infrastructure).
