id: session-004
scope: captcha sessions
status: pending
depends-on: [worker-002]

# Short-lived manual CAPTCHA sessions

## Objective

Implement a secure, short-lived CAPTCHA session store backed by D1, plus `/api/captcha` and `/api/captcha/refresh`. The user manually types the CAPTCHA. The Worker must not bypass challenge, expose upstream Cookie/token/dynamic parameters, or persist user search history.

## Context

- `docs/fangdi-mobile/api-contract.md`
- `docs/fangdi-mobile/data-policy.md`
- `docs/fangdi-mobile/architecture.md`
- PinMe skill D1 migration and Worker constraints

## Path

- Modify: `db/001_init.sql`, Worker route files
- Create: `backend/src/captcha/session-store.ts`, `backend/src/captcha/service.ts`, `backend/test/captcha-session.test.ts`
- Modify: `docs/fangdi-mobile/api-contract.md` and `data-policy.md` only if verified storage details require a contract correction

## Interfaces

```ts
type CaptchaPurpose = 'new-house' | 'old-house';
type CaptchaSession = { sessionId: string; purpose: CaptchaPurpose; expiresAt: string };
interface CaptchaStore {
  create(input: { purpose: CaptchaPurpose; upstreamRef?: string }): Promise<CaptchaSession>;
  get(sessionId: string): Promise<{ purpose: CaptchaPurpose; attempts: number; expiresAt: string } | null>;
  incrementAttempt(sessionId: string): Promise<number>;
  remove(sessionId: string): Promise<void>;
}
```

## Steps

- [ ] Write D1 migration for `captcha_sessions(session_hash PRIMARY KEY, purpose, upstream_ref, attempts, created_at, expires_at)` and expiry index; no user profile/search-history columns.
- [ ] Write tests for random opaque ids, SHA-256 hash-at-rest using a Worker secret salt, 5-minute expiry, remove-on-success/expiry, and max 3 attempts.
- [ ] Implement Web Crypto SHA-256 and `crypto.getRandomValues`; do not use Node filesystem or non-Worker crypto packages.
- [ ] Implement D1 store with parameterized `.prepare().bind()` statements; on read delete expired rows; on attempts >= 3 delete and return `CAPTCHA_EXPIRED`/`RATE_LIMITED`.
- [ ] Implement `/api/captcha` purpose allowlist and fixed upstream CAPTCHA adapter. If upstream CAPTCHA cannot be retrieved as an image without challenge bypass, return `UPSTREAM_BLOCKED` with the appropriate fixed original page URL.
- [ ] Implement `/api/captcha/refresh` to invalidate the old session before creating a new one; never return old session state or upstream headers.
- [ ] Implement in-memory short-window rate limiting for create/refresh and submit boundaries; do not persist IP addresses as long-lived data.
- [ ] Ensure captcha image/data URL, sessionId, entered text and upstream references do not reach logs, Cache API, or error messages.
- [ ] Run D1/session contract tests and Worker typecheck; use a local D1 binding for smoke where available.
- [ ] Commit explicit migration/session/test paths with `feat: add transient captcha sessions`.

## Verification

The verifier must inspect D1 SQL for parameterization and retention, test refresh invalidation and expiry, and block the task if any upstream Cookie, token, challenge query, CAPTCHA text, or arbitrary URL is exposed.
