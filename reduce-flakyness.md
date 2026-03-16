# Reduce Flakyness

## Goal

Get local E2E runs stable when the app is started manually and the test suite is run repeatedly against the same long-lived server.

## Local E2E Setup

Run the server separately and keep it running:

```bash
export SUPABASE_SERVICE_ROLE="<e2e service role key>"
pnpm start:e2e
```

Run tests in another shell:

```bash
export SUPABASE_SERVICE_ROLE="<e2e service role key>"
pnpm e2e
pnpm e2e:repeat
pnpm e2e:repeat -- 10
```

## Main Findings

### 1. Decision page failures were real server-side failures

The flaky tests were not mostly bad selectors or weak waits. The failing pages were often true `500` renders on routes backed by:

- `decision.getInstance`
- `decision.getDecisionBySlug`

Observed symptoms in server logs:

- `fetch failed`
- `UND_ERR_HEADERS_TIMEOUT`
- `User does not have access to this process`
- stale cache behavior between repeated runs
- Redis client noise in E2E

### 2. E2E mode was not fully reaching the browser bundle

Some client-side logic was checking `process.env.E2E`, but that is not a public browser env var. That meant E2E-specific transport behavior was not reliably enabled in the browser.

### 3. Long-lived server caches leaked state between tests and runs

The long-lived app server kept request-independent caches alive across test runs:

- in-memory cache in `services/cache/kv.ts`
- React `cache()` wrappers around server tRPC context/client creation
- cached `getUser()` on the app side

That made repeated runs on the same server dangerous because auth and data lookups could be reused in the wrong context.

### 4. Local Postgres was getting saturated under parallel E2E pressure

The app server, API server, and test processes could all open DB connections aggressively. Under local parallel load this caused decision page requests to stall until they timed out.

### 5. Analytics work added noise during E2E

Decision page loads were still running analytics like `trackProcessViewed`. That adds pointless outbound/background work in E2E and contributes to contention.

### 6. One test had avoidable extra browser/context churn

`decision-settings-permissions.spec.ts` created an additional admin browser context even though an authenticated admin page fixture already existed.

## Changes Made

### E2E runtime and transport

- `package.json`
  - added `e2e:repeat` script
- `services/api/src/links.ts`
  - ~~`NEXT_PUBLIC_E2E` was added for client-side detection but later removed since the transport switching code was reverted~~

### Cache and auth isolation

- `services/cache/kv.ts`
  - disable all caching in E2E
  - skip Redis bootstrap entirely in E2E
- `services/api/src/serverClient.ts`
  - disable React `cache()` wrapping for `createServerContext` in E2E
  - disable React `cache()` wrapping for `createClient` in E2E
- `apps/app/src/utils/getUser.ts`
  - disable cached `getUser()` in E2E

### DB pressure reduction

- `services/db/index.ts`
  - cap the DB pool size to `2` in E2E

### Analytics reduction

- `packages/analytics/src/utils.ts`
  - no-op analytics functions in E2E

### Test cleanup

- `tests/e2e/tests/decision-settings-permissions.spec.ts`
  - reuse the existing authenticated admin page instead of creating another admin context
  - temporary timeout increase was later tightened back down
  - current heading waits are back to `15_000`

### Stress tooling

- `scripts/repeat-e2e.mjs`
  - repeat the root `pnpm e2e` command N times and stop on the first failure

## Verification Performed

### Targeted verification

- `tests/e2e/tests/decision-settings-permissions.spec.ts` passed with:

```bash
pnpm exec playwright test tests/decision-settings-permissions.spec.ts --workers=1 --repeat-each=10 --reporter=list
```

### Full suite verification on the same running server

- `pnpm e2e` passed repeatedly on the same running `pnpm start:e2e` server
- `pnpm e2e:repeat` passed 5 consecutive full-suite runs on the same server

Current observed result:

- `18 passed`
- `5 skipped`

### Type safety

- `pnpm typecheck` passes after the changes

## Practical Conclusion

The biggest sources of local flakiness were not Playwright itself. They were:

1. state leaking through long-lived caches,
2. DB connection pressure under parallel load,
3. unnecessary analytics/background work in E2E,
4. client E2E mode not being exposed correctly to the browser bundle.

After fixing those, repeated local runs on the same manually started server became stable.

## Current Commands I Trust

```bash
export SUPABASE_SERVICE_ROLE="<e2e service role key>"
pnpm start:e2e
```

In another shell:

```bash
export SUPABASE_SERVICE_ROLE="<e2e service role key>"
pnpm e2e
pnpm e2e:repeat
```
