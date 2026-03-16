# E2E Tests (Playwright)

End-to-end tests using Playwright against an isolated Supabase instance.

## Port Isolation

| Environment | Ports       |
| ----------- | ----------- |
| Dev         | 54321-54329 |
| Test        | 55321-55329 |
| **E2E**     | 56321-56329 |

## Setup

### First-time setup

```bash
# From repo root - start e2e Supabase, run migrations, seed data
pnpm w:e2e supabase:setup
```

This runs: `supabase:start` + `supabase:migrate` + `supabase:seed`

### Prerequisites

- Docker running (for Supabase)
- `.env.local` at repo root (copied from `.env.example`)

## Running Tests

Tests run against a **pre-built production build**, not the dev server. This makes dynamic page generation much faster and more reliable.

### Step 1: Build

```bash
# From repo root — builds both app and api with E2E env vars/mocks
pnpm build:e2e
```

This sets `E2E=true` and the required env vars, then runs `next build` for both `apps/app` (port 4100) and `apps/api` (port 4300).

### Step 2: Start servers

```bash
# From repo root — starts production servers on e2e ports
pnpm start:e2e
```

Wait for both `http://localhost:4100` and `http://localhost:4300` to be reachable.

### Step 3: Run tests

```bash
pnpm e2e        # headless
pnpm e2e:ui     # Playwright UI mode
```

### All-in-one (CI does this)

In CI, the build step runs once and uploads `.next` artifacts. Test shards download them, start servers, then run:

```bash
pnpm build:e2e
pnpm start:e2e &
# wait for servers...
pnpm e2e
```

## Supabase Management

All commands run from repo root using `pnpm w:e2e`:

```bash
pnpm w:e2e supabase:start    # Start e2e Supabase instance
pnpm w:e2e supabase:stop     # Stop it
pnpm w:e2e supabase:status   # Check status
pnpm w:e2e supabase:migrate  # Run DB migrations
pnpm w:e2e supabase:seed     # Seed test data
pnpm w:e2e supabase:reset    # Reset DB (destructive)
```

## E2E Mocks

When `E2E=true`, webpack aliases swap external services for in-process mocks:

- **`@op/collab`** → `@op/collab/testing` (TipTap Cloud — no HTTP calls)
- **`@op/analytics`** → `@op/analytics/testing` (PostHog — no network calls, reduces idle time)

## Writing Tests

Tests live in `tests/e2e/tests/*.spec.ts`. Use fixtures from `fixtures/`:

```typescript
import { expect, test } from '../fixtures';

test('example', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Common/);
});
```

### Auth fixture (if needed)

```typescript
import { expect, test } from '../fixtures';

test('authenticated test', async ({ authenticatedPage }) => {
  // Already logged in — session stored in memory (no temp files)
});
```

## Configuration

`playwright.config.ts` sets:

- `baseURL`: `http://localhost:4100`
- `timeout`: 60s per test
- `retries`: 2 in CI, 0 locally
- `workers`: 2 in CI, 4 locally

## Flake Fixes

- **In-memory auth**: Session storage state is held in memory instead of written to disk files, eliminating file-system race conditions between workers.
- **Analytics mock**: PostHog is replaced with a no-op mock at build time, preventing network calls that kept the page from reaching network idle and caused flaky `waitForLoadState` timeouts.
- **Reduced DB connections**: `E2E=true` limits the connection pool to 1, preventing connection exhaustion under parallel workers.
