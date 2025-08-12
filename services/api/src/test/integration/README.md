# Invite System Integration Tests

This directory contains comprehensive integration tests for the invite system functionality.

## Test Files

### `invite.integration.test.ts`
Tests the complete invite workflow including:
- **New User Invites**: Inviting users who don't exist in the system yet
- **Existing User Invites**: Directly adding existing users to organizations
- **Join Organization Flow**: Users joining via invite links and domain matching
- **Role Assignment**: Ensuring correct roles are applied during invites
- **Error Scenarios**: Handling invalid inputs, unauthorized access, etc.

### `role-id.integration.test.ts`
Tests role ID system specifically:
- **Role Fetching**: `getRoles()` API functionality
- **Role Assignment**: Role assignment by ID instead of name
- **Role Persistence**: Maintaining assignments through role renames
- **Fallback Logic**: Admin role fallbacks for edge cases
- **Data Integrity**: Database relationships and constraints

## Key Test Scenarios

### Invite Flow Testing
1. **New User Workflow**:
   - Invite sent → allowList entry created with roleId
   - User signs up → joins organization → gets assigned role from invite

2. **Existing User Workflow**:
   - Existing user invited → directly added to organization with role
   - No allowList entry created for existing users

3. **Role ID Persistence**:
   - Roles stored by ID in invite metadata
   - Works even if role names change between invite and join
   - Proper fallback to Admin role when needed

### Error Scenarios Covered
- Invalid role IDs
- Invalid organization IDs
- Unauthorized invite attempts  
- Duplicate organization memberships
- Domain access restrictions
- Malformed email addresses

## Running the Tests

### Prerequisites
1. **Supabase Local Instance**: Must be running on port 55321
   ```bash
   # Start Supabase local instance
   supabase start
   ```

2. **Test Database**: Migrations must be applied to test database
   ```bash
   # Run test migrations
   pnpm w:db migrate:test
   ```

### Run Tests
```bash
# Run all integration tests
cd services/api
pnpm test

# Run only invite tests
pnpm test invite.integration.test.ts

# Run only role ID tests  
pnpm test role-id.integration.test.ts

# Run with coverage
pnpm test --coverage
```

### Test Environment
- **Database**: Local Supabase instance on port 55322
- **Auth**: Test Supabase auth on port 55321
- **Isolation**: Each test gets fresh database state
- **Cleanup**: Automatic cleanup between tests

## Test Data Management

### Cleanup Strategy
Tests use `cleanupTestData()` to remove test data between runs:
```typescript
await cleanupTestData([
  'organization_user_to_access_roles',
  'organization_users', 
  'allow_list',
  'organizations',
  'profiles',
  // ... other tables
]);
```

### Test User Creation
```typescript
// Create fresh users for each test
const testEmail = `test-${Date.now()}@example.com`;
await createTestUser(testEmail);
await signInTestUser(testEmail);
```

### Database State
- Each test starts with clean slate
- Test data is isolated by unique timestamps
- Foreign key relationships are properly managed

## Debugging Tests

### Common Issues
1. **Supabase Not Running**: Ensure local Supabase is started
2. **Migration Issues**: Run `pnpm w:db migrate:test` if schema is outdated
3. **Port Conflicts**: Check ports 55321/55322 are available
4. **Cleanup Failures**: Tests may leave data if interrupted - restart Supabase

### Debug Output
```typescript
// Add debug logging in tests
console.log('Test data:', { orgUser, roles, allowListEntry });
```

### Database Inspection
```bash
# Connect to test database
psql postgresql://postgres:postgres@127.0.0.1:55322/postgres

# Check test data
SELECT * FROM allow_list WHERE email LIKE '%test%';
SELECT * FROM organization_users WHERE email LIKE '%test%';
```

## Coverage Goals

These tests aim for comprehensive coverage of:
- ✅ All invite API endpoints
- ✅ Role assignment logic  
- ✅ Database transactions
- ✅ Authorization checks
- ✅ Error handling
- ✅ Edge cases and boundary conditions

## Continuous Integration

Tests are designed to run in CI environments with:
- Isolated test database per run
- No external dependencies
- Deterministic test data
- Proper cleanup and teardown