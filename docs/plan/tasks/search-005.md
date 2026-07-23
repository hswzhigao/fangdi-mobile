id: search-005
scope: house search adapters
status: pending
depends-on: [worker-002, session-004]

# New-house and old-house search adapters

## Objective

Implement validated new-house and old-house list/detail routes, pagination, and manual CAPTCHA session integration only where the real upstream contract is confirmed. Unknown schema or WAF blocking must be an explicit error; no guessed success payloads.

## Context

- `docs/fangdi-mobile/api-contract.md`
- `docs/fangdi-mobile/data-policy.md`
- `docs/fangdi-mobile/architecture.md`
- `docs/fangdi-mobile/ui-layout.md`
- `working-evidence-round1.md`, `working-evidence-round3.md`

## Path

- Create/modify: `backend/src/upstream/new-house.ts`, `old-house.ts`, `backend/src/routes/new-house.ts`, `old-house.ts`, normalizers and Worker route registration
- Create: `backend/test/search-validation.test.ts`, `backend/test/search-normalizers.test.ts`, sanitized fixtures
- Modify design docs only when real upstream request/response evidence changes the fixed contract

## Interfaces

```ts
async function listNewHouses(filter: NewHouseFilter, env: Env): Promise<ApiEnvelope<Page<HouseSummary>>>;
async function getNewHouse(id: string, env: Env): Promise<ApiEnvelope<HouseDetail>>;
async function listOldHouses(filter: OldHouseFilter, env: Env): Promise<ApiEnvelope<Page<HouseSummary>>>;
async function getOldHouse(id: string, env: Env): Promise<ApiEnvelope<HouseDetail>>;
// HTTP routes: POST /api/new-house/search, GET /api/new-house/:id, POST /api/old-house/search, GET /api/old-house/:id
```

## Steps

- [ ] Use browser network inspection or an authorized test environment to identify the actual fixed method, form parameter names, pagination, CAPTCHA requirement, and response shape for each route; do not bypass the WAF or reverse-engineer challenge code.
- [ ] Write validation tests for every documented filter, unknown keys, numeric ranges, enum values, page bounds, keyword lengths, id pattern, and missing/expired/foreign captcha session.
- [ ] Write normalizer tests from sanitized real schema examples; assert malformed data returns `UPSTREAM_SCHEMA` and never constructs a fake item.
- [ ] Implement fixed new-house adapter for the verified upstream endpoint and map only `HouseSummary`/`HouseDetail` allowlist fields.
- [ ] Implement fixed old-house adapter and, if verified, market summary mapping for `sellcount`, area, amount and average price; retain source freshness note.
- [ ] Integrate captcha store: purpose must match route; validate text only in the request body/query according to the final verified upstream method; increment attempts atomically and delete on success.
- [ ] Disable caching for list/detail/search responses and do not prefetch pages.
- [ ] Add fixed fallback URLs for block, timeout and schema errors.
- [ ] Run search validation/normalizer tests, Worker typecheck, and local smoke for valid/invalid list and detail requests.
- [ ] Commit explicit search adapter/route/test paths with `feat: add house search adapters`.

## Verification

The verifier must confirm list/detail paths execute real adapters, not static fake data, and that missing upstream schema is surfaced. Any attempt to pass user-provided upstream path/URL or to simulate CAPTCHA success is blocking.
