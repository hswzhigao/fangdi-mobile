id: frontend-006
scope: vue shell and public pages
status: pending
depends-on: [bootstrap-001, content-003]

# Vue mobile shell and public pages

## Objective

Build the Vue 3 mobile shell with five bottom tabs, API client, source attribution, and Home/Lease/Trade pages. Implement loading, empty, error, retry, and fixed original-site fallback states before adding complex search UI.

## Context

- `docs/fangdi-mobile/README.md`
- `docs/fangdi-mobile/architecture.md`
- `docs/fangdi-mobile/api-contract.md`
- `docs/fangdi-mobile/ui-layout.md`
- `docs/fangdi-mobile/data-policy.md`

## Path

- Create/modify: `frontend/src/main.ts`, `App.vue`, `router.ts`, `api/client.ts`, `api/types.ts`, `pages/Home/**`, `pages/Lease/**`, `pages/Trade/**`, `components/**`, `styles/**`
- Test: `frontend/test/api-client.test.ts`, page/component tests

## Interfaces

```ts
export const API: string;
export function getApiUrl(path: string): string;
export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T>;
export async function apiPost<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T>;
type ApiState<T> = { status: 'idle' | 'loading' | 'success' | 'empty' | 'error'; data?: T; error?: ApiError };
```

## Steps

- [ ] Write API client tests for relative URL construction, successful envelope unwrapping, each documented error code, malformed envelope, AbortError, and no logging of response bodies.
- [ ] Implement `api/types.ts` to mirror the backend stable types; keep `unknown` at the network boundary and validate envelope shape before use.
- [ ] Implement a single `fetch` wrapper with timeout/abort support, JSON content type, no credential mode, and `ApiError` conversion; pages must not call `fetch` directly.
- [ ] Implement `AppShell`/`App.vue` with sticky top bar, `RouterView`, fixed five-tab navigation, safe-area padding and source disclaimer.
- [ ] Implement Home page sections: transaction summary, quick links, notice/policy/news segmented list, recent house cards and original-site button.
- [ ] Implement Lease page as FAQ accordion, download cards, fixed public links and clear limitation note; do not show unverified rental listings.
- [ ] Implement Trade page metric cards, district list/table, verified freshness note and original-site button.
- [ ] Implement reusable `LoadingState`, `EmptyState`, `ErrorState`, `FallbackLink`, and card/list primitives using Vant conventions.
- [ ] Add responsive CSS for 320px and 430px widths, horizontal overflow only for dense statistics, and 44px touch targets.
- [ ] Run frontend typecheck, unit/component tests, production build, and browser smoke at a mobile viewport.
- [ ] Commit explicit frontend paths with `feat: add vue mobile public pages`.

## Verification

The verifier must check that all pages use the API client, source/fallback links are fixed allowlist URLs, untrusted HTML is not rendered with `v-html`, and every page has loading/empty/error states.
