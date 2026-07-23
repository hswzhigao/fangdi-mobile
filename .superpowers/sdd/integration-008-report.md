# Integration-008: End-to-end Verification and PinMe Release Gate

**Status:** ✅ Local verification and PinMe deployment passed
**Date:** 2026-07-23  
**Commit:** verify with `git rev-parse HEAD` — the report is part of the commit and intentionally does not hard-code a self-referential SHA  
**Parent:** `0d02f4f` feat: add search and captcha ux  
**Subject:** `chore: add integration smoke and release checks`

## Executive Summary

Local checks passed: `npm run typecheck` (0 errors), `npm test` (427 total: 354 backend + 73 frontend), `npm run build` (worker 61 KiB / gzip 13 KiB, frontend 79 modules), secret scan (0 secrets in 71 files), local Worker smoke tests (27 passed, 2 skipped, 0 failed, 29 total), and smoke lifecycle tests (6 passed, 0 failed). PinMe CLI is authenticated and deployment was verified remotely; the first two proxy-mediated `pinme save` attempts failed with `ECONNRESET`, then a direct-network retry succeeded.

---

## 1. Build & Static Checks

| Check | Result |
|---|---|
| `npm run typecheck` (vue-tsc + tsc) | ✅ 0 errors |
| `npm test` (backend) | ✅ 354 passed, 9 files |
| `npm test` (frontend) | ✅ 73 passed, 5 files |
| `npm run build` (worker) | ✅ 61 KiB / gzip 13 KiB |
| `npm run build` (frontend) | ✅ 79 modules, 200 KB CSS + 95 KB JS (gzip: 54+38) |
| `node scripts/check-secrets.mjs` | ✅ 0 secrets in 71 files |

---

## 2. Smoke Tests (27 passed, 2 skipped, 29 total)

All tests run with `fetchJson` (15s timeout per request). Worker lifecycle uses `stopWorker` with await-exit and SIGTERM/SIGKILL cleanup.

### Health
- `GET /api/health` → 200 ok `{ service: "fangdi-mobile-api", status: "ok" }`
- `OPTIONS /api/health` → 204 with CORS headers
- `POST /api/health` → 404 NOT_FOUND (exact method+path routing)

### Public Routes
- `GET /api/home` → 502 UPSTREAM_BLOCKED (proxy blocks upstream, correct envelope)
- `GET /api/notices?kind=proclamation&page=1&pageSize=5` → allowed contract status (200/502/504, verifies error code in upstream error set)
- `GET /api/notices?kind=bogus` → **400 BAD_REQUEST** (asserts status + code)
- `GET /api/trade` → 502 (upstream blocked, correct error contract)
- `GET /api/lease` → **200 ok with data** (static route, asserts status=200, ok=true, data present)

### Search Invalid-Input
- POST new-house with `district: "!!invalid!!"` → **502/504 UPSTREAM_BLOCKED/UPSTREAM_TIMEOUT** (passes validation, hits upstream; asserts upstream status+code contract)
- POST new-house with empty body `{}` → **400 BAD_REQUEST** (asserts status + code)
- POST old-house with nonexistent captcha → **500 INTERNAL_ERROR** (no D1: captcha validation unreachable)
- POST new-house with non-JSON body → **400 BAD_REQUEST** (asserts status + code)

### Detail Invalid-ID
- `GET /api/new-house/invalid id` → **400 BAD_REQUEST** (asserts status + code — spaces not allowed)
- `GET /api/new-house/nonexistent-99999` → 502 UPSTREAM_BLOCKED (valid id format, upstream blocked)
- `GET /api/old-house/aaaa...81chars` → **400 BAD_REQUEST** (asserts status + code — too long)

### CAPTCHA Purpose/Error
- `GET /api/captcha?purpose=new-house` → **500 INTERNAL_ERROR** (no D1 binding locally; asserts status + code)
- `GET /api/captcha?purpose=bogus` → **SKIP** — purpose validation unreachable without D1; returns INTERNAL_ERROR before purpose check
- `GET /api/captcha` → **SKIP** — purpose validation unreachable without D1; returns INTERNAL_ERROR before purpose check
- `POST /api/captcha/refresh` with bad sessionId → **500 INTERNAL_ERROR** (no D1; asserts status + code)

> **Note:** CAPTCHA returns INTERNAL_ERROR (500) locally because D1 is not bound in `wrangler dev` (no `--d1` flag). Purpose-validation assertions (invalid/missing purpose → BAD_REQUEST) are skipped with explicit reason when D1 is unavailable. The `captcha.test.ts` suite (59 tests) validates the full flow with mocked D1, and all pass. If a D1-backed URL is supplied via CLI argument, all purpose-validation assertions run in full.

### No-Proxy
- `GET /api/arbitrary` → **404 NOT_FOUND** (asserts status + code)
- `GET /api/../../etc/passwd` → **404 NOT_FOUND** (asserts status + code — traversal)
- `GET /` (root) → **404 NOT_FOUND** (asserts status + code — root must return NOT_FOUND)

### Safe Headers
- `Content-Type: application/json; charset=utf-8` ✅
- `X-Content-Type-Options: nosniff` ✅
- No unexpected upstream cookies; Cloudflare edge cookies (`__cf_bm`, `__cflb`, `cf_clearance`) allowed ✅
- No upstream `Server` header leak ✅
- No `X-Powered-By` header ✅

### Sensitive Data
- No JWT, token, cookie, secret, or credential patterns in `/api/health` or `/api/home` responses ✅
- Uses `fetchJson` with 15s timeout (consistent with other tests)

---

## 3. Secret Scanner (`check-secrets.mjs`)

- **AWS Secret Key heuristic:** Removed the broad `/[A-Za-z0-9/+]{40}/` pattern. Replaced with high-confidence AWS `AKIA` prefix pattern for Access Key IDs and assignment-context pattern (`secret_access_key` / `aws_secret` / `secret_key` = `<40-char base64>`) for secret keys.
- **No `matchedText` in hit objects:** Hit objects only contain `{ file, line, desc }`. Secrets are never printed.
- **Generated metadata:** `secret_text` bindings are explicitly detected without printing their values.
- **Self-exclusion:** `check-secrets.mjs` and `smoke-api.mjs` are excluded from scanning via `EXCLUDE_FILES`.
- **Result:** 0 secrets detected across 71 scannable files; `check-secrets:test` proves a generated secret binding fails safely.

---

## 4. UI Structural Check (320/430px)

- **Five-tab layout:** Tabbar with 首页/新房/二手房/租赁/统计 ✅
- **Source attribution:** "数据来源：网上房地产公开信息 | 非官方客户端" bar ✅
- **Safe area:** `env(safe-area-inset-bottom)` applied ✅
- **Loading:** `LoadingState` with `van-skeleton` ✅
- **Error:** `ErrorState` with retry + fallback URL ✅
- **Empty:** `EmptyState` with fallback link ✅
- **Filter:** `FilterToolbar` + `FilterSheet` on NewHouse/OldHouse pages ✅
- **Captcha dialog:** `CaptchaDialog` component present ✅
- **Fallback links:** `FallbackLink` component on all pages ✅
- **Pagination:** `PaginationBar` component present ✅
- **Responsive:** `@media (min-width: 431px)` breakpoints (mobile-first, covers 320-430) ✅
- **Routes:** All 8 routes match design contract (`ui-layout.md`) ✅

> **Limitation:** Browser not available in this agent session for live visual inspection at 320/430 viewports. Structural verification via code review confirms component tree, responsive breakpoints, and state variants match the design spec.

---

## 5. Design Docs / Code Consistency

| Contract Element | Design Doc | Code | Status |
|---|---|---|---|
| API routes | `api-contract.md` §Routes | `worker.ts` L352-367 | ✅ exact match |
| Envelope shape | `api-contract.md` §Envelope | `envelope.ts` L26-40 | ✅ exact match |
| Error codes (12) | `api-contract.md` §ErrorCodes | `envelope.ts` L10-12 | ✅ exact match |
| HTTP status mapping | `api-contract.md` table | `envelope.ts` L50-63 | ✅ exact match |
| Home cache (60s) | `data-policy.md` L22 | `cache.ts` L16 | ✅ 60 |
| Notices cache (5min) | `data-policy.md` L23 | `cache.ts` L17 | ✅ 300s |
| Trade cache (5min) | `data-policy.md` L24 | `cache.ts` L18 | ✅ 300s |
| Lease cache (1h) | `data-policy.md` L25 | `cache.ts` L19 | ✅ 3600s |
| No-cache routes | `data-policy.md` L26-28 | `cache.ts` L27-32 | ✅ exact match |
| Captcha session table | `data-policy.md` L36-43 | `db/001_init.sql` | ✅ exact match |
| Upstream base URL | `architecture.md` L90 | `fetch.ts` L13 | ✅ hardcoded constant |
| CORS origins | `architecture.md` L63-65 | `cors.ts` L8-11 | ✅ allowlist |
| No credentials | `data-policy.md` L64 | `cors.ts` L58 | ✅ never set |
| No upstream URL relay | `api-contract.md` §Routes | `worker.ts` L372-406 | ✅ fixed routes only |
| Frontend API client | `architecture.md` L46 | `client.ts` | ✅ single fetch wrapper |

---

## 6. PinMe Release Gate

**Status: DEPLOYED**

`pinme --version` returned 2.0.12 and `pinme show-appkey` confirmed an authenticated session. After rebuilding the Worker into the project-root `dist-worker/` directory and retrying `pinme save` without inherited proxy variables, deployment succeeded for project `fangdi-mobile-7569`.

- Frontend: https://d902d242.pinme.dev
- Worker: https://fangdi-mobile-7569.api.pinme.pro
- Console: https://pinme.eth.limo/#/console/projects/fangdi-mobile-7569

Remote verification: `/api/health` returned HTTP 200 with the expected service/status envelope; remote smoke passed 27 tests with the same 2 no-D1 purpose-validation skips. The first two proxy-mediated attempts failed with `ECONNRESET`; no credentials or token values are recorded.

---

## 7. Files Changed

| File | Action |
|---|---|
| `scripts/smoke-api.mjs` | Updated — startup failure cleanup (stopWorker before exit), timeout killing process, tightened lease/notices/search-9 assertions |
| `scripts/smoke-lifecycle.test.mjs` | Added — 6 child-process lifecycle tests (no secrets, no wrangler) |
| `scripts/check-secrets.mjs` | Updated — removed broad AWS 40-char heuristic, high-confidence AWS assignment context, secret_text metadata detection, no matchedText storage |
| `scripts/check-secrets.test.mjs` | Added — generated secret_text regression test with value-redacted output assertion |
| `package.json` | Updated — added `smoke` and `smoke:lifecycle` and `check-secrets` scripts |
| `.superpowers/sdd/integration-008-report.md` | Updated — this report |

---

## 8. Verification Summary

```
✅ typecheck:         0 errors
✅ test (backend):    354 passed
✅ test (frontend):   73 passed
✅ build (worker):    61 KiB OK
✅ build (frontend):  OK
✅ secret scan:       0 secrets in 71 files
✅ secret scan regression: 1 passed
✅ smoke (local):     27 passed, 2 skipped, 0 failed (29 total)
✅ smoke lifecycle:   6 passed, 0 failed
✅ UI structural:     consistent with design docs
✅ docs/code:         consistent
✅ PinMe deploy:      saved; frontend and Worker URLs recorded above
```

### No-D1 Purpose-Validation Limitation

When running locally with `wrangler dev` (no `--d1` flag), the CAPTCHA service returns `INTERNAL_ERROR` (500) immediately because `getCaptchaService(env)` returns `null`. This means purpose-validation assertions for invalid/missing purpose (expected: 400 BAD_REQUEST) cannot be distinguished from the no-D1 error. The smoke test detects this condition via `detectD1Available()` and skips those assertions with explicit reasons. Supplying a D1-backed URL as a CLI argument enables full assertions.

### PinMe/Browser Blockers

- **PinMe deployment:** succeeded after retrying without inherited proxy variables. Frontend: `https://d902d242.pinme.dev`; Worker: `https://fangdi-mobile-7569.api.pinme.pro`.
- **Browser visual inspection:** live browser visual inspection was not run in this session; remote HTML and `/api/health` were checked with curl.

---

## 9. Smoke Lifecycle Tests

`scripts/smoke-lifecycle.test.mjs` (6 tests, run with `npm run smoke:lifecycle` or `node --test`) validates the child-process lifecycle used by `smoke-api.mjs`:

| Test | Assertion |
|---|---|
| startup failure does not leak child processes | Process killed after simulate-failure |
| stopWorker pattern terminates process | SIGTERM → SIGKILL cleanup within fallback window |
| stopWorker safe on already-exited process | No throw when process already exited |
| stopWorker no-op on null/undefined | Guard clause works |
| startup rejection calls stopWorker cleanup | Mirrors exact smoke-api.mjs pattern |
| stopWorker waits for exit not killed flag, resolves fast for exited | Checks `exitCode !== null` (not `killed`); fast-resolve for naturally-exited process |

These tests run without wrangler, use only `node:child_process` and `node:test`, and require no secrets or external services.
