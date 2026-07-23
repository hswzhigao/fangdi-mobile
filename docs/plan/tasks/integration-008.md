id: integration-008
scope: release integration
status: pending
depends-on: [content-003, session-004, search-005, frontend-007]

# End-to-end validation and PinMe release gate

## Objective

Validate the complete local frontend → Worker → adapter/session path, mobile UI states, safe failure behavior, production build, and PinMe deployment readiness. Deploy only after the user has authenticated the CLI and confirms the generated project name.

## Context

- `docs/INDEX.md`
- `docs/fangdi-mobile/architecture.md`
- `docs/fangdi-mobile/api-contract.md`
- `docs/fangdi-mobile/data-policy.md`
- `docs/fangdi-mobile/ui-layout.md`
- all preceding task files and review reports

## Path

- Create/modify: `scripts/smoke-api.mjs`, `scripts/check-secrets.mjs`, release notes under `docs/plan/`
- Test: end-to-end/local integration tests and browser smoke artifacts
- Do not modify generated PinMe config unless CLI requires it

## Interfaces

- `npm run typecheck`
- `npm test`
- `npm run build`
- local Worker at `http://localhost:8787`
- `pinme save` for first full deploy; `pinme update-worker` / `pinme update-web` only for isolated subsequent updates

## Steps

- [ ] Start the local Worker and Vite frontend using the documented scripts; confirm Vite `/api` proxy reaches Worker `/api/health`.
- [ ] Run smoke calls for home, lease and trade; verify both sanitized success fixtures (if authorized) and real upstream block/timeout mapping.
- [ ] Run new/old search invalid-input tests, then a real valid request; if upstream requires CAPTCHA, verify the manual dialog path without bypass or OCR.
- [ ] Use browser mobile viewport to check all five tabs, 320px/430px layouts, source attribution, loading/empty/error/fallback states, pagination and detail navigation.
- [ ] Inspect browser console, Worker output and network logs for cookies, tokens, challenge parameters, CAPTCHA text, raw bodies or arbitrary URLs; fail the gate if any appear.
- [ ] Run `npm run typecheck`, `npm test`, `npm run build`, and record exact pass output. Review all docs/code contract consistency.
- [ ] Run `pinme --version`; if not logged in, stop with a deployment blocker and report the exact command `pinme login` without claiming a URL.
- [ ] After authentication and project name confirmation, run `pinme save`; record only the final public URL and deployment timestamp, never credentials or logs containing secrets.
- [ ] For later isolated changes use `pinme update-worker` or `pinme update-web`; otherwise use full `pinme save`.
- [ ] Commit explicit smoke/release docs and message `test: validate mobile worker integration` before deployment; do not use `--no-verify`.

## Verification

Release passes only when local API and UI work, no sensitive data is exposed, the original-site fallback is usable, all tests/build pass, and PinMe output provides an actual URL. A blocked upstream is an accepted, clearly surfaced runtime state, not a test failure, provided the error contract is correct.
