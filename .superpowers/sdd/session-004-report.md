# session-004 Review Fix Report

## Fix Summary

All 3 Critical and 3 Important findings from session-004-1.md resolved.

### Critical Fixes

1. **CaptchaPurpose type** — Defined `CaptchaPurpose = 'new-house' | 'old-house'` in `backend/src/captcha/types.ts`. Used throughout store, service, and routes. `VALID_PURPOSES` exported for allowlist checking.

2. **GET /api/captcha purpose validation** — Route now requires `?purpose=new-house|old-house` (exact allowlist via `CaptchaService.validatePurpose`). Returns `BAD_REQUEST` on missing/invalid purpose.

3. **In-memory rate limiting** — `RateLimiter` (`backend/src/captcha/rate-limiter.ts`): per-key 10-request/60s window, safe hashed CF-Connecting-IP key, bounded map with periodic cleanup, no IP persistence. Returns `RATE_LIMITED` (429) with `Retry-After` header for create/refresh/submit boundaries. Worker handlers call `checkRateLimit()` before any service call.

### Important Fixes

4. **CaptchaStore abstraction** — `CaptchaStore` interface (`create/get/incrementAttempt/remove`) with parameterized D1-backed `D1CaptchaStore` in `backend/src/captcha/session-store.ts`. Routes/service use the abstraction; old `session.ts` removed.

5. **CaptchaService** — `backend/src/captcha/service.ts` orchestrates purpose validation, store lifecycle, refresh invalidation, validateAndIncrement with atomic increment-then-check, and error mapping. Worker HTTP handlers are thin.

6. **Max-attempt mapping** — Documented and tested: max 3 attempts, hit on 3rd attempt returns `CAPTCHA_EXPIRED` (410, not retryable), session deleted. `validateAndIncrement` increments then checks; if the new count >= 3, deletes and returns `CAPTCHA_EXPIRED`. Consistent with api-contract (CAPTCHA_EXPIRED = 410) and data-policy (max 3 attempts per session).

### Minor/Additional

- Filename: `session-store.ts` per task spec; old `session.ts` deleted.
- Purpose-specific fallback URLs: `FALLBACK_URLS` in service maps `new-house` → new_house page, `old-house` → old_house page.
- Purpose binding: `refreshSession` and `validateAndIncrement` support optional `expectedPurpose` for session-purpose binding validation.
- No CAPTCHA image/data, sessionId, entered text exposed in logs, URLs, or error messages.
- New-house/old-house content adapters NOT implemented (out of scope per task).

### Tests

- **59** new tests in `backend/test/captcha.test.ts` covering:
  - Purpose allowlist (7 tests)
  - Fallback URLs (3 tests)
  - Session ID generation (3 tests)
  - Hash (3 tests)
  - D1CaptchaStore.create/get/incrementAttempt/remove (12 tests)
  - CaptchaStore interface compliance (1 test)
  - RateLimiter (6 tests: within window, rate limited, Retry-After, separate IPs, fallback key, no raw IP)
  - CaptchaService.createSession (2 tests: UPSTREAM_BLOCKED + purpose-specific fallback)
  - CaptchaService.refreshSession (5 tests: invalid, expired, maxed, purpose binding mismatch, purpose binding match)
  - CaptchaService.validateAndIncrement (6 tests: valid, invalid, expired, maxed, purpose mismatch, purpose match)
  - Max-attempt consistency (2 tests)
  - Full lifecycle (3 tests)
  - Error mapping reference (3 tests)

### Verification Commands

```bash
cd backend
npx tsc --noEmit          # PASS (0 errors)
npm test                  # PASS (155 tests, 3 files)
npx wrangler deploy --dry-run  # PASS (18.96 KiB)
```

### Git

Amended commit `f8f6601` with subject `feat: add transient captcha sessions`.
`git rev-list --count 49cd260..HEAD` = 1.
