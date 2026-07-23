# Frontend-007 Report: Search UX and Manual CAPTCHA Dialog

## Status: ✅ Complete (with review fixes amended)

## Summary
Implemented NewHouse/OldHouse search with filter panel, chips, pagination, CAPTCHA dialog, and detail pages.

## Changed Files

### New Files (9)
- `frontend/src/utils/filter.ts` — serializeFilter/deserializeFilter with captcha stripping
- `frontend/src/components/CaptchaDialog.vue` — create→manual input→submit→invalid/expired/blocked/success flow
- `frontend/src/components/FilterToolbar.vue` — active filter chips display, filter/reset buttons
- `frontend/src/components/FilterSheet.vue` — bottom sheet with Vant fields/pickers for NewHouse/OldHouse filters
- `frontend/src/components/HouseCard.vue` — responsive card with name/district/area/status/rooms
- `frontend/src/components/PaginationBar.vue` — prev/next with page indicator and 44px touch targets
- `frontend/src/views/HouseDetail.vue` — detail page with allowlisted fields + original site fallback
- `frontend/test/filter-state.test.ts` — 21 tests for serialization, key allowlists, captcha stripping, round-trip, cross-page type safety
- `frontend/test/captcha-dialog.test.ts` — 14 tests for dialog render/submit/error/loading/sessionId hiding

### Modified Files (4)
- `frontend/src/api/types.ts` — added NewHouseFilter, OldHouseFilter, PropertyType, HouseStatus, CaptchaData types
- `frontend/src/router/index.ts` — added `/new-house/:id` and `/old-house/:id` detail routes
- `frontend/src/views/NewHouse.vue` — full search with filter, captcha, pagination, error/empty states
- `frontend/src/views/OldHouse.vue` — full search with filter, captcha, pagination, error/empty states

## Review #1 Fixes Applied (amended to ab633db)

### Fix 1: Captcha AbortController (Important #1, #4 in report)
- Added dedicated `captchaAbortController` in both NewHouse.vue and OldHouse.vue
- `fetchCaptcha()` creates new AbortController, aborts previous, passes `signal` to `apiGet('/api/captcha?...', signal)`
- AbortError ignored in catch block — stale captcha responses cannot mutate current state
- Captcha controller aborted in `clearCaptcha()` and `onUnmounted()`
- Main search abort behavior preserved (separate `abortController`)

### Fix 2: Cross-page Type Safety (Important #2)
- `getFilterFromQuery()` in both pages now enforces page type: `params.set('type', 'new-house'|'old-house')` before deserializing
- URL with `type=old-house` on `/new-house` route is parsed as NewHouseFilter — foreign fields (minPrice, rooms, keyword) stripped
- URL with `type=new-house` on `/old-house` route is parsed as OldHouseFilter — foreign fields (projectName, status) stripped
- Watch handlers updated to use same type enforcement pattern
- Removed unsafe `as NewHouseFilter`/`as OldHouseFilter` cast; now cast on known-safe deserialized result
- Added 2 tests: cross-page type query for both directions

### Fix 3: Dead Code Removal (Important #3)
- Removed unused `setIntersection` function from `frontend/src/utils/filter.ts:37-43`

### Fix 4: RATE_LIMITED UI Handling (Important #3 in review body)
- Both NewHouse.vue and OldHouse.vue `doSearch()`: explicit `RATE_LIMITED` check before generic error, sets clear Chinese message "请求过于频繁，请稍后重试" with `retryable: true`
- Both pages `fetchCaptcha()`: explicit `RATE_LIMITED` handling for captcha fetch errors
- ErrorState component test added for RATE_LIMITED display with retry button
- No Retry-After seconds invented — API client doesn't expose it; safe retry action retained

## Test Results (After Fixes)

### Commands
```
npx vitest run            # 73 tests passed (5 files)
npx vue-tsc --noEmit     # no errors
npm run build             # built in 485ms
```

### Test Coverage
- **filter-state.test.ts**: 21 tests — serializeFilter/deserializeFilter, URL encoding, captcha field stripping, allowed-only keys, round-trip integrity, page clamping, min/max validation, cross-page type safety (2 new)
- **captcha-dialog.test.ts**: 14 tests — visible/hidden, refresh emit, submit with text, empty submit prevention, loading prevention, CAPTCHA_INVALID/EXPIRED/BLOCKED errors, loading state, accessible labels, sessionId not in DOM, 44px touch target
- **components.test.ts**: 15 tests — LoadingState, EmptyState, ErrorState (incl. RATE_LIMITED), FallbackLink, no v-html check
- **Existing tests**: 23 tests continue passing (bootstrap 5, api-client 18)

## Implementation Details

### Filter Serialization
- `serializeFilter()` strips `captchaSession` and `captchaText` — never in URL
- `deserializeFilter()` reads only allowed keys from `URLSearchParams`, rejects captcha fields
- Page type enforced at page boundary — cross-page type markers ignored
- Page clamped to 1-10000, pageSize to 1-20
- Enum values validated against allowlists; non-numeric strings ignored
- `min > max` validation: both values dropped if violated

### Captcha Flow
1. Search API returns `CAPTCHA_REQUIRED` → dialog opens, fetches `/api/captcha?purpose=...`
2. User enters text, submits → captcha fields set on filter, re-searches
3. `CAPTCHA_INVALID` → error shown, user can re-enter without re-fetching image
4. `CAPTCHA_EXPIRED` → session cleared, new captcha auto-fetched
5. `UPSTREAM_BLOCKED` → session cleared, error state with fallback link
6. `RATE_LIMITED` → explicit Chinese retry-later message with retry button
7. Captcha cleared on: filter reset, route change, dialog close, expired/invalid cleanup
8. Dedicated AbortController for captcha — stale responses discarded

### Safety Requirements Met
- ✅ No sessionId or captchaText in URL (serializeFilter strips)
- ✅ No sessionId or captchaText in localStorage
- ✅ No sessionId exposed as copyable UI text
- ✅ Abort on unmount (AbortController cleanup for both search and captcha)
- ✅ Cross-page type enforcement — foreign filter fields cannot leak
- ✅ No polling, no auto-crawling
- ✅ No OCR, no auto-solving, no bypass
- ✅ No v-html for upstream content
- ✅ 44px minimum touch targets on submit/refresh buttons
- ✅ Accessible labels (aria-label on input, dialog, buttons)
- ✅ Reset page to 1 on filter changes

### API Calls
- `POST /api/new-house/search` and `POST /api/old-house/search` via `apiPost`
- `GET /api/new-house/:id` and `GET /api/old-house/:id` via `apiGet`
- `GET /api/captcha?purpose=new-house|old-house` via `apiGet` (with AbortSignal)
- All through shared `apiPost`/`apiGet` — no direct `fetch` calls

## Commit
```
feat: add search and captcha ux
```
(amended, single commit ab633db)
