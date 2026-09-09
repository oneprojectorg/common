# Vitest + Supabase Integration Testing

This directory holds the harness for running integration tests with Vitest against an **isolated test Supabase instance**. It is published as `@op/common/testing` so `packages/common`, `services/api` and `services/workflows` can all use it.

## Isolated Test Environment

The test setup uses a **separate Supabase instance** running on different ports:

| Service   | Development | Testing   |
| --------- | ----------- | --------- |
| API       | 54321       | **55321** |
| Database  | 54322       | **55322** |
| Studio    | 54323       | **55323** |
| Inbucket  | 54324       | **55324** |
| Analytics | 54327       | **55327** |

This allows you to:

- ✅ Keep your development Supabase running
- ✅ Run tests in complete isolation
- ✅ Avoid port conflicts
- ✅ Reset test data without affecting development

## Prerequisites

1. **Docker** - Make sure Docker is installed and running
2. **Supabase CLI** - Install the Supabase CLI

## Getting Started

### 1. Start Test Supabase Instance

```bash
# Start the isolated test instance
pnpm test:supabase:start

# Check status
pnpm test:supabase:status

# Stop when done (optional)
pnpm test:supabase:stop
```

This starts a completely separate Supabase instance for testing.

### 2. Verify Test Supabase is Running

```bash
pnpm test:check-supabase
```

This script checks if the **test instance** (port 55321) is accessible.

### 3. Run Database Migrations (Optional)

`globalSetup.ts` migrates and seeds on every run, so this is only needed to
inspect the database outside a test run.

```bash
pnpm w:db migrate:test
pnpm w:db seed:test
```

### 4. Run Integration Tests

```bash
# Every package, unit projects first, then integration one package at a time
pnpm test

# A single package
pnpm w:api test
pnpm w:common test:integration
pnpm w:workflows test:integration
```

### 5. Manage Test Supabase Instance

```bash
# Start test instance
pnpm test:supabase:start

# Check status
pnpm test:supabase:status

# Complete database reset with fresh migrations and seed
pnpm test:db:reset

# Stop test instance
pnpm test:supabase:stop
```

## Test Configuration

### Environment Variables

The test setup automatically configures these environment variables for the **test instance**:

- `NEXT_PUBLIC_SUPABASE_URL`: `http://127.0.0.1:55321` _(test port)_
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Default Supabase demo key
- `DATABASE_URL`: `postgresql://postgres:postgres@127.0.0.1:55322/postgres` _(test port)_
- `NODE_ENV`: `test`

### Test Setup (`setup.ts`)

The setup file:

- Initializes a Supabase test client
- **Automatically runs Drizzle migrations and seeds** before tests
- Mocks environment variables
- Provides global setup/teardown hooks
- Configures test isolation

### Test Utilities (`supabase.ts`)

Utility functions for common test operations, re-exported from
`@op/common/testing`:

- `createTestUser()` - Create test users
- `signInTestUser()` - Authenticate test users
- `insertTestData()` - Insert test data

tRPC callers live in `services/api/src/test/caller.ts` instead, because they
need `appRouter`.

## Writing Integration Tests

### Basic Test Structure

```typescript
import { describe, expect, it } from 'vitest';

import { createTestUser } from '@op/common/testing';

describe('My Integration Tests', () => {
  it('should test database operations', async () => {
    // Create test user
    const user = await createTestUser('test@example.com');

    expect(user).toBeDefined();
  });
});
```

### Testing Authentication

```typescript
it('should handle user authentication', async () => {
  const email = `test-${Date.now()}@example.com`;

  // Create and sign in user
  await createTestUser(email);
  const session = await signInTestUser(email);

  expect(session.user).toBeDefined();
  expect(session.session).toBeDefined();
});
```

### Testing Real-time Features

```typescript
it('should handle real-time subscriptions', async () => {
  let received = false;

  const subscription = supabaseTestClient
    .channel('test-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'my_table',
      },
      () => {
        received = true;
      },
    )
    .subscribe();

  // Trigger change
  await insertTestData('my_table', { name: 'test' });

  // Wait for real-time event
  await new Promise((resolve) => setTimeout(resolve, 1000));

  await supabaseTestClient.removeChannel(subscription);
  expect(received).toBe(true);
});
```

## Best Practices

### Test Isolation

- Each test should clean up after itself
- Use `beforeEach` hooks to reset state
- Use unique identifiers (timestamps) for test data

### Database Schema

- Tests assume certain tables exist (profiles, posts, etc.)
- Adjust table names and fields based on your actual schema
- Use try/catch blocks for optional schema-dependent tests

### Performance

- Integration tests run sequentially to avoid database conflicts
- Use appropriate timeouts for database operations
- Clean up only necessary tables to improve speed

### Error Handling

- Test both success and failure scenarios
- Verify error messages and codes
- Handle cases where tables might not exist

## Troubleshooting

### Supabase Not Running

```
❌ Cannot connect to Supabase. Is it running?

To start Supabase locally:
  1. Make sure Docker is running
  2. Run: supabase start
  3. Wait for all services to be ready
```

### Connection Issues

- Verify Docker is running: `docker ps`
- Check Supabase status: `supabase status`
- Restart Supabase: `supabase stop && supabase start`

### Schema Issues

If tests fail due to missing tables:

1. Check your migrations: `supabase db diff`
2. Apply migrations: `supabase db reset`
3. Adjust test table names to match your schema

### Port Conflicts

Default ports from `supabase/supabase-dev.toml`:

- API: 54321
- DB: 54322
- Studio: 54323

Change ports in config if they conflict with other services.

## File Structure

```
packages/common/testing/
├── README.md            # This file
├── index.ts             # `@op/common/testing` entry point
├── constants.ts         # TEST_USER_DEFAULT_PASSWORD
├── globalSetup.ts       # Migrate + seed once per run, verify empty tables after
├── setup.ts             # Per-file setup: module mocks, Supabase clients
├── supabase.ts          # Test user / session / insert helpers
├── vitest.ts            # TEST_ENV and defineIntegrationProject({ root })
├── unitSetup.ts         # Unit-project guard against a real database connection
├── check-supabase.ts    # Supabase health check script
├── supabase-test.ts     # Test Supabase instance management script
├── data/                # Shared data builders, also re-exported by `@op/test`
└── helpers/             # Test data managers
```

## Configuration Files

- `vitest.ts` - shared vitest options, consumed by each package's `vitest.config.ts`
- `../../../supabase/supabase-test.toml` - test Supabase configuration
- `../package.json` - the harness scripts (`test:supabase:*`, `test:check-supabase`)
