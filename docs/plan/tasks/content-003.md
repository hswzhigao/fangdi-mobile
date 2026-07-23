id: content-003
scope: public content adapters
status: pending
depends-on: [worker-002]

# Public content, lease information, and cache

## Objective

Implement fixed upstream adapters and normalizers for the homepage, notices, current trade snapshot, and lease FAQ/download content. Use allowlisted routes, bounded requests, short Cache API TTLs, and explicit fallback on challenge/block/schema failures.

## Context

- `docs/fangdi-mobile/architecture.md`
- `docs/fangdi-mobile/api-contract.md`
- `docs/fangdi-mobile/data-policy.md`
- `docs/fangdi-mobile/ui-layout.md`
- `working-evidence-round1.md`, `working-evidence-round3.md`

## Path

- Create/modify: `backend/src/upstream/home.ts`, `notices.ts`, `trade.ts`, `lease.ts`, `normalizers.ts`, `backend/src/cache/cache.ts`, Worker route registration
- Create: `backend/test/upstream-normalizers.test.ts`, `backend/test/cache-policy.test.ts`, sanitized JSON fixtures under `backend/test/fixtures/`
- Modify: `docs/fangdi-mobile/api-contract.md` only if real schema verification changes a field; update docs and code atomically

## Interfaces

```ts
async function getHome(request: Request, env: Env): Promise<ApiEnvelope<HomeData>>;
async function getNotices(url: URL, env: Env): Promise<ApiEnvelope<Page<Notice>>>;
async function getTrade(url: URL, env: Env): Promise<ApiEnvelope<TradeData>>;
async function getLease(env: Env): Promise<ApiEnvelope<LeaseData>>;
function normalizeUpstreamJson<T>(input: unknown, schema: Schema<T>): T | ApiError;
```

`HomeData`, `Notice`, `Page<T>`, `TradeData` and `LeaseData` must match `docs/fangdi-mobile/api-contract.md` exactly.

## Steps

- [ ] Capture only sanitized, non-secret response examples from authorized low-frequency browser inspection; if the upstream returns 412/challenge, record an error fixture instead of attempting bypass.
- [ ] Write parser tests for valid field mapping, missing optional fields, malformed top-level data, overlong titles, HTML stripping, and no raw upstream body in the returned envelope.
- [ ] Implement fixed endpoint constants under `https://www.fangdi.com.cn`; each adapter declares its method, path, timeout and form keys. Never accept a URL parameter.
- [ ] Implement homepage aggregation with per-module failure isolation only when the contract can distinguish missing module from empty list; otherwise fail with `UPSTREAM_SCHEMA` rather than silently inventing empty data.
- [ ] Implement notice kind allowlist (`proclamation|policy|news`), page bounds, and fixed detail URL construction from validated opaque ids only.
- [ ] Implement trade current snapshot and map only validated numeric metrics; omit unverified historical trend fields and set a limitation note when necessary.
- [ ] Implement lease FAQ/download data from fixed, reviewed content and fixed source URLs; clearly set `limitation` to say that a public rental listing API is not verified.
- [ ] Implement Cache API helpers with TTL 60 seconds for home, 5 minutes for notices/trade, 1 hour for lease; never cache captcha, details, errors, or filter queries.
- [ ] Map HTTP 412, challenge HTML, timeout, non-JSON and schema mismatch to the documented errors and fixed fallback URL.
- [ ] Run normalizer/cache tests, Worker typecheck, and a local HTTP smoke for `/api/home`, `/api/trade`, `/api/lease`.
- [ ] Commit explicit adapter/cache/test paths with `feat: add public content adapters`.

## Verification

The verifier must distinguish fixture parser tests from real integration: fixtures may test normalization, but route smoke must execute the actual adapter and prove blocked upstream responses produce `UPSTREAM_BLOCKED` without a fake success body.
