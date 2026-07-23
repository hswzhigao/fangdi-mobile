id: frontend-007
scope: vue search experience
status: pending
depends-on: [frontend-006, search-005]

# Vue house filters, pagination, details, and CAPTCHA dialog

## Objective

Add new-house and old-house list/detail pages with validated filter panels, pagination, URL-safe query state, and a manual CAPTCHA flow connected to the real API contract.

## Context

- `docs/fangdi-mobile/api-contract.md`
- `docs/fangdi-mobile/ui-layout.md`
- `docs/fangdi-mobile/data-policy.md`
- `frontend/src/api/client.ts` and stable types from `frontend-006`

## Path

- Create/modify: `frontend/src/pages/NewHouse/**`, `OldHouse/**`, `HouseDetail/**`, `components/FilterToolbar.vue`, `FilterSheet.vue`, `CaptchaDialog.vue`, `components/PaginationBar.vue`, route definitions
- Test: `frontend/test/filter-state.test.ts`, `captcha-dialog.test.ts`, search page tests

## Interfaces

```ts
interface CaptchaDialogProps { purpose: 'new-house' | 'old-house'; visible: boolean; }
interface CaptchaDialogEmits { submit: [sessionId: string, text: string]; refresh: []; close: []; }
function serializeFilter(filter: NewHouseFilter | OldHouseFilter): string;
function deserializeFilter(query: URLSearchParams): NewHouseFilter | OldHouseFilter;
```

## Steps

- [ ] Write filter serialization tests for allowed keys only, page reset on filter change, min/max validation, URL encoding and no sessionId/captchaText in browser URL.
- [ ] Write CaptchaDialog tests for create, manual text submit, refresh invalidation, loading duplicate prevention, `CAPTCHA_INVALID`, `CAPTCHA_EXPIRED`, `UPSTREAM_BLOCKED`, close and retry behavior.
- [ ] Implement filter sheet with Vant fields/selects, chips, reset/apply controls, focus movement, and a11y labels; do not send unknown fields.
- [ ] Implement new-house and old-house list pages with skeleton, cards, pagination and detail navigation. Use `POST /api/new-house/search` and `POST /api/old-house/search` through the shared client; use GET only for validated detail ids.
- [ ] Implement session flow: on `CAPTCHA_REQUIRED`, call `GET /api/captcha?purpose=...`; display returned image; submit user-entered text to the fixed search route; never expose session id as copyable UI or URL query.
- [ ] Implement details with allowlisted fields and fixed original-site fallback; show schema/block errors rather than guessed sections.
- [ ] Clear session when filters reset, route changes purpose, page query changes, or dialog expires; abort in-flight requests on unmount.
- [ ] Run frontend tests, typecheck, build and mobile browser smoke for filter → captcha → list/error → detail/fallback states.
- [ ] Commit explicit frontend search paths with `feat: add mobile house search flows`.

## Verification

Any CAPTCHA bypass, OCR, sessionId in URL/localStorage, automatic page crawling, direct upstream request, or hardcoded fake listing is blocking.
