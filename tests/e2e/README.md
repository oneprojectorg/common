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

## Background workflows (Inngest)

Specs that exercise a background job — currently `proposals-export.spec.ts` — need an Inngest dev server. `apps/api` already serves the workflow handler at `/api/v1/workflows`; the dev server is what relays a sent event back to it. Without one, `event.send` has nowhere to go and the export never leaves `pending`.

Playwright starts it via the `webServer` entry in `playwright.config.ts`, so there is nothing to do by hand. Two things worth knowing:

- An already-running dev server on `:8288` is reused. Locally that is the only option — a second cannot start beside the one the `:3300` stack uses, because the executor's gRPC ports (50052/50053) are fixed. Specs `PUT` the serve URL to register the e2e app's functions into whichever server answers, so reuse needs no extra setup.
- `start:e2e` sets `INNGEST_DEV=1`. That is what points the production build's SDK at `127.0.0.1:8288` instead of Inngest Cloud — `next start` runs as `NODE_ENV=production`, where the SDK otherwise assumes the hosted service.

Do **not** add a CI step to start it. The e2e workflow triggers on `pull_request_target`, so GitHub runs the workflow file from the base branch: a step added on a feature branch does not execute until it merges, and the two would then race for `:8288` once it did.

## E2E Mocks

When `E2E=true`, webpack aliases swap external services for in-process mocks:

- **`@op/collab`** → `@op/collab/testing` (TipTap Cloud — no HTTP calls)
- **`@op/analytics/client`** → `client.testing.ts` (PostHog — no network calls, reduces idle time)

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
