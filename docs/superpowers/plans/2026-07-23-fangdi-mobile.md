# 网上房地产移动版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Vue 3 mobile adaptation of `fangdi.com.cn` covering the home page, new-house and old-house search, lease FAQ/materials, and trade statistics through a same-origin PinMe Worker API with safe degradation when the upstream is blocked or unverified.

**Architecture:** A Vue 3 + Vite + TypeScript + Vant frontend calls only relative `/api/*` paths. A PinMe Cloudflare Worker exposes a strict route allowlist, validates and normalizes upstream public responses, uses short Cache API TTLs for non-personalized data, and stores only short-lived hashed CAPTCHA session metadata in D1. The Worker never implements arbitrary URL proxying, challenge bypass, OCR, login, or persistence of upstream cookies/tokens.

**Tech Stack:** Vue 3, Vite, TypeScript, Vant, PinMe full-stack template, Cloudflare Worker APIs, D1 SQLite, Web Crypto, Vitest/component tests, browser mobile smoke tests.

## Global Constraints

- Use Vue 3 + Vite + TypeScript + Vant; adapt the PinMe generated React frontend rather than inventing an unrelated deployment layout.
- Frontend production requests use relative `/api/*`; local Vite proxies `/api` to Worker `localhost:8787`.
- Worker routes are fixed allowlists; do not add `/api/proxy?url=...` or any arbitrary URL relay.
- Reuse only public upstream pages/APIs through fixed adapters; do not bypass WAF, dynamic challenge, CAPTCHA, or login.
- CAPTCHA is entered manually by the user; do not add OCR, challenge reverse engineering, batch crawling, automatic polling, or infinite pagination.
- Never expose or log upstream cookies, tokens, challenge parameters, CAPTCHA text, session ids, credentials, or raw upstream bodies.
- When upstream access/status/schema fails, return documented error codes and a fixed original-site fallback link; never fabricate success data.
- Do not persist user query history, personal property data, or long-lived IP profiles.
- All numeric/text/id/pagination inputs fail fast with clear errors; use parameterized D1 statements.
- Do not claim remote deployment or passing checks without command output evidence; do not commit unless explicitly requested by the user.
- Runtime uncertainty is accepted only where documented: rental listing API, historical trade schema, and new/old-house filter schema must be verified before implementation.

## Design Documents

- `docs/INDEX.md`
- `docs/fangdi-mobile/README.md`
- `docs/fangdi-mobile/architecture.md`
- `docs/fangdi-mobile/api-contract.md`
- `docs/fangdi-mobile/data-policy.md`
- `docs/fangdi-mobile/ui-layout.md`
- `docs/plan/analysis/fangdi-mobile.md`
- `docs/plan/tasks/*.md`

## Task 1: Bootstrap PinMe template and Vue frontend

**Files:**
- Create/modify: root `package.json`, `.gitignore`, generated PinMe project files, `frontend/`, `backend/`, `db/001_init.sql`
- Test: `backend/test/health.test.ts`, `frontend/test/bootstrap.test.ts`
- Context: `docs/plan/tasks/bootstrap-001.md`

**Interfaces:**
- `GET /api/health` returns `{ ok: true, data: { service: 'fangdi-mobile-api', status: 'ok' } }`.
- `getApiUrl(path: string): string` uses `import.meta.env.VITE_API_URL || ''`.

- [ ] Confirm/install `pinme`, inspect the generated template with `pinme create`, and preserve generated config files.
- [ ] Initialize Git only if absent, add safe ignores, and ensure no credentials or `.env` values are tracked.
- [ ] Convert generated React entry to Vue 3 + Vite + TypeScript + Vant without changing PinMe’s generated backend wiring.
- [ ] Add Worker health route, Vite `/api` proxy, test scripts and minimal original-site attribution page.
- [ ] Run `npm install`, typecheck, tests, production build, local Worker health smoke; commit only intended bootstrap paths if user later requests commits.

## Task 2: Implement Worker HTTP contracts and safe routing

**Files:**
- Modify: `backend/src/worker.ts` and generated route entry
- Create: focused HTTP envelope, validation, CORS modules and `backend/test/http-contract.test.ts`
- Context: `docs/plan/tasks/worker-002.md`, `docs/fangdi-mobile/api-contract.md`, `docs/fangdi-mobile/data-policy.md`

**Interfaces:**
- `ApiErrorCode` and `ApiEnvelope<T>` are the exact union from the API contract.
- `json<T>()` applies JSON content type, `nosniff`, and no upstream headers.
- `parsePageParams()` enforces page `1..10000`, pageSize `1..20`.

- [ ] Write failing tests for envelope shape, error mappings, OPTIONS/CORS, unknown paths/query keys and invalid input.
- [ ] Implement strict method/path dispatch, safe CORS allowlist, finite numeric/text/id validation and exception-to-error mapping.
- [ ] Verify no route constructs an upstream URL from user input and no generic proxy is present.
- [ ] Run focused Worker tests and typecheck.

## Task 3: Implement public content adapters and bounded caching

**Files:**
- Create/modify: fixed upstream adapters for home/notices/trade/lease, normalizers, Cache API helpers, route registration
- Test: sanitized parser fixtures and cache policy tests
- Context: `docs/plan/tasks/content-003.md`, `docs/fangdi-mobile/architecture.md`, `api-contract.md`, `data-policy.md`

**Interfaces:**
- `getHome()`, `getNotices()`, `getTrade()`, `getLease()` return the exact documented stable envelopes.
- Fixed fallback URLs are selected by route; no arbitrary URL input.

- [ ] Capture or author only sanitized fixtures from authorized public responses; preserve 412/challenge as blocked fixtures.
- [ ] Write parser tests for valid, malformed, overlong and unsafe text inputs.
- [ ] Implement fixed endpoint methods, schema validation, HTML-to-text normalization, isolated known modules, and explicit unknown-schema errors.
- [ ] Implement Cache API TTLs: home 60s, notices/trade 5m, lease 1h; never cache errors, CAPTCHA, details or filter queries.
- [ ] Run parser/cache tests, typecheck and local route smoke.

## Task 4: Implement transient manual CAPTCHA sessions

**Files:**
- Modify: `db/001_init.sql`, Worker route registration
- Create: D1 session store, CAPTCHA service, tests
- Context: `docs/plan/tasks/session-004.md`, `docs/fangdi-mobile/api-contract.md`, `data-policy.md`

**Interfaces:**
- `CaptchaStore.create/get/incrementAttempt/remove` as specified in the task file.
- `GET /api/captcha` and `POST /api/captcha/refresh` return `CaptchaData` or documented errors.

- [ ] Add parameterized D1 migration for hashed opaque sessions with expiry index.
- [ ] Write failing tests for hashing, TTL, refresh invalidation, max attempts, purpose binding and no sensitive values in output/logs.
- [ ] Implement Web Crypto random ids and SHA-256 salt hashing, D1 cleanup, rate limiting and fixed CAPTCHA adapter.
- [ ] Return `UPSTREAM_BLOCKED` instead of attempting to bypass challenge when no safe image response exists.
- [ ] Run local D1/session tests and Worker typecheck.

## Task 5: Implement verified new-house and old-house adapters

**Files:**
- Create/modify: new/old-house fixed adapters, route handlers, normalizers and tests
- Context: `docs/plan/tasks/search-005.md`, `docs/fangdi-mobile/api-contract.md`, `architecture.md`

**Interfaces:**
- `listNewHouses(filter)`, `getNewHouse(id)`, `listOldHouses(filter)`, `getOldHouse(id)`.
- Output is `Page<HouseSummary>` or allowlisted `HouseDetail`; no fake item on schema mismatch.

- [ ] Observe actual method/parameter/pagination/schema through allowed browser/dev setup, without challenge bypass or batch enumeration.
- [ ] Write validation and sanitized normalizer tests before implementation.
- [ ] Implement fixed adapters, pagination, detail mapping, CAPTCHA purpose/attempt integration, no-cache search responses and fixed fallbacks.
- [ ] Run focused tests, typecheck and valid/invalid local smoke.

## Task 6: Implement Vue shell and public pages

**Files:**
- Create/modify: Vue shell, router, API client/types, Home/Lease/Trade pages, shared state/error/fallback components, styles
- Test: API client and component tests
- Context: `docs/plan/tasks/frontend-006.md`, `docs/fangdi-mobile/ui-layout.md`, `api-contract.md`

**Interfaces:**
- `apiGet<T>()`, `apiPost<T>()`, `ApiState<T>` and stable types from the task file.

- [ ] Write failing API client tests for envelope/error/abort behavior.
- [ ] Implement single fetch wrapper and strict network boundary validation.
- [ ] Build five-tab shell and responsive states, then Home, Lease and Trade user-visible sections.
- [ ] Add source attribution and fixed original-site fallback links; never use `v-html` for untrusted upstream content.
- [ ] Run frontend tests/typecheck/build and mobile viewport smoke.

## Task 7: Implement search UX and manual CAPTCHA dialog

**Files:**
- Create/modify: NewHouse/OldHouse list/detail pages, filter sheet, chips, pagination and CAPTCHA dialog
- Test: filter state, CAPTCHA dialog and search page tests
- Context: `docs/plan/tasks/frontend-007.md`, `docs/fangdi-mobile/ui-layout.md`, `api-contract.md`, `data-policy.md`

**Interfaces:**
- `CaptchaDialog` props/emits, `serializeFilter()` and `deserializeFilter()` from the task file.

- [ ] Write failing tests ensuring allowed query keys, page reset, no session/text in URL/localStorage and all CAPTCHA states.
- [ ] Implement filters with Vant, list/detail calls through API client, pagination and responsive cards.
- [ ] Implement create → manual input → submit → invalid/expired/blocked/success flow, clear stale session on context changes and abort on unmount.
- [ ] Run frontend tests/typecheck/build and mobile smoke.

## Task 8: End-to-end verification and PinMe release gate

**Files:**
- Create/modify: `scripts/smoke-api.mjs`, `scripts/check-secrets.mjs`, release notes
- Context: `docs/plan/tasks/integration-008.md` and all design/task/review docs

**Interfaces:**
- `npm run typecheck`, `npm test`, `npm run build`, local Worker `:8787`, PinMe `save/update-*`.

- [ ] Run Vite + Worker same-origin proxy health and all route smoke checks.
- [ ] Verify real upstream success where authorized and explicit WAF/schema block otherwise; test manual CAPTCHA only.
- [ ] Check five-tab UI at 320/430px, error/fallback states, console and Worker output for sensitive data.
- [ ] Run all checks and record evidence; review design/code consistency.
- [ ] If PinMe is authenticated and project name confirmed, run `pinme save` and return the actual URL; otherwise report the exact external blocker and do not fabricate a URL.

## Self-review

- **Spec coverage:** B pages are covered by Tasks 3 and 6; C filtering/paging/detail/CAPTCHA by Tasks 4, 5 and 7; same-origin Worker by Tasks 1/2/8; lease uncertainty is explicitly handled by Task 3; WAF/CAPTCHA safety and fallbacks are global constraints and tests in Tasks 3–5/8; PinMe deployment is Task 8.
- **Placeholder scan:** The only conditional language is an explicit runtime gate around unverified upstream schema and PinMe authentication. No task tells an implementer to add unspecified validation or leave a TODO/mock as a final route.
- **Type consistency:** `ApiEnvelope`, `ApiErrorCode`, `Page`, filter names, `CaptchaStore`, and frontend helpers are defined in `docs/fangdi-mobile/api-contract.md` or the task files and reused consistently.
- **Known correction:** The design does not treat the prior investigation’s unverified API schemas or rental listing capability as facts. It also avoids using the erroneous Round 3 HEAD-only security-header claim as an implementation dependency.
