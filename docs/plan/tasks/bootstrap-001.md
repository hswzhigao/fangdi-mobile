id: bootstrap-001
scope: project bootstrap
status: pending
depends-on: []

# Bootstrap Vue + PinMe project

## Objective

Initialize the empty workspace from the PinMe full-stack template, replace the generated frontend entry with Vue 3 + Vite + TypeScript + Vant, preserve generated PinMe configuration, add a Worker health route and runnable checks. Do not deploy in this task and do not add secrets.

## Context

- `docs/INDEX.md`
- `docs/fangdi-mobile/README.md`
- `docs/fangdi-mobile/architecture.md`
- `docs/plan/analysis/fangdi-mobile.md`
- PinMe skill: `pinme create <dir>`, generated `pinme.toml`/`backend/wrangler.toml`/`frontend/.env`, `pinme save` only after implementation.

## Path

- Create/modify: root `package.json`, `.gitignore`, `frontend/`, `backend/`, `db/001_init.sql`
- Generated and not manually edited by default: `pinme.toml`, `backend/wrangler.toml`, `frontend/.env`
- Test: `backend/test/health.test.ts`, `frontend/test/bootstrap.test.ts`

## Interfaces

- Produces `GET /api/health` → `{ ok: true, data: { service: 'fangdi-mobile-api', status: 'ok' } }`.
- Produces frontend `getApiUrl(path: string): string` using `import.meta.env.VITE_API_URL || ''`.
- Produces scripts `dev`, `typecheck`, `test`, `build` and a documented local Worker port `8787`.

## Steps

- [ ] Confirm `pinme` is installed; if not, install the latest CLI with `npm install -g pinme@latest`, then run `pinme --version`.
- [ ] Confirm the workspace has no unrelated source; initialize Git only if absent with `git init -b main`, then create a `.gitignore` that excludes `node_modules`, `dist`, `.env*` except committed examples, `.wrangler`, coverage, and PinMe local state.
- [ ] Run `pinme create fangdi-mobile` in a temporary sibling path, inspect the generated template, and move/rename only within the current workspace without copying any generated secrets.
- [ ] Keep the generated root PinMe files intact; configure workspace scripts to invoke frontend build/typecheck/test and backend typecheck/test without assuming Node-only Worker APIs.
- [ ] Replace the generated React entry with Vue `createApp`, a minimal `App.vue`, Vite `/api` proxy to `http://localhost:8787`, and a Vant CSS import. The minimal page must visibly state the service name and link to the original site.
- [ ] Add Worker health routing and JSON response headers without implementing business routes yet; unknown routes must return 404 rather than a fake success.
- [ ] Add the database migration file with no user data tables yet; leave only the migration structure needed by later `session-004` or use an empty migration if the PinMe template requires one.
- [ ] Run `npm install`, `npm run typecheck`, `npm test`, and `npm run build`; run the local Worker and request `/api/health` with `curl`.
- [ ] Commit only bootstrap files with `git add <explicit paths>` and message `chore: bootstrap vue and pinme worker`.

## Verification

Expected: Vue production build creates `frontend/dist`; Worker typecheck passes; health returns HTTP 200 with the exact data shape; `/api/unknown` returns HTTP 404; no `.env` value, token, Cookie, or generated app key appears in tracked files or test output.
