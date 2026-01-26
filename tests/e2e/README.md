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

### Option 1: Auto-starts dev server (recommended)

```bash
# From repo root
pnpm e2e        # headless
pnpm e2e:ui     # Playwright UI mode
```

Playwright will automatically start `pnpm dev:e2e` (dev server on port 3100 with e2e env vars) and wait for it.

### Option 2: Manual dev server (for debugging)

Terminal 1:
```bash
pnpm dev:e2e    # Starts app at localhost:3100 with e2e Supabase
```

Terminal 2:
```bash
pnpm e2e        # Reuses existing server (reuseExistingServer: true in config)
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

## Writing Tests

Tests live in `tests/e2e/tests/*.spec.ts`. Use fixtures from `fixtures/`:

```typescript
import { test, expect } from '../fixtures';

test('example', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Common/);
});
```

### Auth fixture (if needed)

```typescript
import { test, expect } from '../fixtures';

test('authenticated test', async ({ authenticatedPage }) => {
  // Already logged in
});
```

## Configuration

`playwright.config.ts` sets:
- `baseURL`: `http://localhost:3100`
- `webServer.command`: `pnpm dev:e2e` (auto-starts dev server)
- `timeout`: 60s per test
- `retries`: 2 in CI, 0 locally
