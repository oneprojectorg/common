# Vitest + Supabase Integration Testing

This directory contains the setup for running integration tests with Vitest against a local Supabase Docker instance.

## Prerequisites

1. **Docker** - Make sure Docker is installed and running
2. **Supabase CLI** - Install the Supabase CLI
3. **Local Supabase instance** - Start your local Supabase instance

## Getting Started

### 1. Start Supabase

From the project root:

```bash
supabase start
```

This will start all Supabase services locally, including:
- PostgreSQL database (port 54322)
- API server (port 54321) 
- Studio (port 54323)
- Auth server
- Storage
- Edge Functions

### 2. Verify Supabase is Running

```bash
pnpm w:api test:check-supabase
```

This script checks if Supabase is accessible and ready for testing.

### 3. Run Database Migrations (Optional)

```bash
# Check Supabase and run migrations
pnpm w:api test:migrate

# Or run migrations manually
supabase db push --local
```

### 4. Run Integration Tests

```bash
# Run all integration tests once
pnpm w:api test:integration

# Run integration tests in watch mode
pnpm w:api test:integration:watch

# Run integration tests with automatic migrations
pnpm w:api test:integration:migrate

# Run all tests (unit + integration)
pnpm w:api test

# Run with coverage
pnpm w:api test:coverage
```

## Test Configuration

### Environment Variables

The test setup automatically configures these environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`: `http://127.0.0.1:54321`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Default Supabase demo key
- `NODE_ENV`: `test`

### Test Setup (`setup.ts`)

The setup file:
- Initializes a Supabase test client
- **Automatically runs database migrations** before tests
- Mocks environment variables
- Provides global setup/teardown hooks
- Configures test isolation

### Test Utilities (`supabase-utils.ts`)

Utility functions for common test operations:
- `cleanupTestData()` - Clean database tables
- `createTestUser()` - Create test users
- `signInTestUser()` - Authenticate test users  
- `insertTestData()` - Insert test data
- `resetTestDatabase()` - Reset database to clean state

## Writing Integration Tests

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { supabaseTestClient } from '../setup';
import { cleanupTestData, createTestUser } from '../supabase-utils';

describe('My Integration Tests', () => {
  beforeEach(async () => {
    // Clean up before each test
    await cleanupTestData(['my_table']);
  });

  it('should test database operations', async () => {
    // Create test user
    const user = await createTestUser('test@example.com');
    
    // Test your database operations
    const { data, error } = await supabaseTestClient
      .from('my_table')
      .insert({ user_id: user.user!.id, name: 'test' });
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
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
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'my_table' 
    }, () => {
      received = true;
    })
    .subscribe();

  // Trigger change
  await insertTestData('my_table', { name: 'test' });
  
  // Wait for real-time event
  await new Promise(resolve => setTimeout(resolve, 1000));
  
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

Default ports from `supabase/config.toml`:
- API: 54321
- DB: 54322  
- Studio: 54323

Change ports in config if they conflict with other services.

## File Structure

```
src/test/
├── README.md                      # This file
├── setup.ts                       # Global test setup
├── supabase-utils.ts              # Test utility functions
├── check-supabase.ts              # Supabase health check script
├── sample.test.ts                 # Basic unit tests
└── integration/
    └── supabase.integration.test.ts   # Integration test examples
```

## Configuration Files

- `vitest.config.ts` - Vitest configuration with Supabase environment
- `../../supabase/config.toml` - Supabase local configuration
- `package.json` - Test scripts and dependencies