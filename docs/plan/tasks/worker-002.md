id: worker-002
scope: worker core
status: pending
depends-on: [bootstrap-001]

# Worker core contracts

## Objective

Implement the fixed `/api/*` router, strict input validation, stable error envelope, explicit CORS allowlist, and safe response headers. No upstream adapter may accept a user-supplied URL.

## Context

- `docs/fangdi-mobile/README.md`
- `docs/fangdi-mobile/architecture.md`
- `docs/fangdi-mobile/api-contract.md`
- `docs/fangdi-mobile/data-policy.md`
- `docs/plan/analysis/fangdi-mobile.md`

## Path

- Modify: `backend/src/worker.ts` or the generated route files
- Create: `backend/src/http/envelope.ts`, `backend/src/http/validation.ts`, `backend/src/http/cors.ts` if the template supports this split
- Test: `backend/test/http-contract.test.ts`

## Interfaces

```ts
type ApiErrorCode = 'BAD_REQUEST' | 'NOT_FOUND' | 'METHOD_NOT_ALLOWED' | 'RATE_LIMITED' | 'CAPTCHA_REQUIRED' | 'CAPTCHA_EXPIRED' | 'CAPTCHA_INVALID' | 'UPSTREAM_BLOCKED' | 'UPSTREAM_TIMEOUT' | 'UPSTREAM_BAD_STATUS' | 'UPSTREAM_SCHEMA' | 'INTERNAL_ERROR';
type ApiEnvelope<T> = { ok: true; data: T; meta?: { source: 'upstream' | 'fallback'; cached: boolean; fetchedAt: string } } | { ok: false; error: { code: ApiErrorCode; message: string; retryable: boolean; fallbackUrl?: string } };
function json<T>(body: ApiEnvelope<T>, status?: number, request?: Request): Response;
function parsePageParams(url: URL): { page: number; pageSize: number } | ApiError;
```

## Steps

- [ ] Write tests for exact success/error envelope, all known error code HTTP mappings, and absence of upstream response headers.
- [ ] Write tests that unknown routes, unknown query keys, malformed ids, page `0`, pageSize `21`, negative values, and `min > max` return `BAD_REQUEST` or `NOT_FOUND` as specified.
- [ ] Implement `json()` with `Content-Type: application/json; charset=utf-8`, `X-Content-Type-Options: nosniff`, safe cache headers, and no `Set-Cookie` passthrough.
- [ ] Implement method + exact pathname routing for `/api/health`; reserve fixed route names for later tasks and return 404 for unimplemented routes rather than a fake business payload.
- [ ] Implement CORS: `OPTIONS` returns 204; allowed origins are deployment config plus `http://localhost:5173`; arbitrary Origin is not echoed; do not enable credentials.
- [ ] Implement parser helpers with finite non-negative numbers, integer page range `1..10000`, pageSize `1..20`, text length `1..80`, and id regex `^[A-Za-z0-9_-]{1,80}$`.
- [ ] Add a catch boundary that maps timeout, blocked status and unknown exceptions to documented errors without logging request bodies/URLs.
- [ ] Run `npm run typecheck` and `npm test -- worker/test/http-contract.test.ts` (using the repository's actual test command).
- [ ] Commit explicit Worker and test paths with `feat: add worker api contracts`.

## Verification

A verifier must confirm no generic proxy route exists, no arbitrary upstream URL is constructed from query input, CORS is an allowlist, and all tests cover the documented contracts.
