# Integration Testing Pattern

This document establishes the standard pattern for managing test data in integration tests.

## Core Principle

**Every test that creates data MUST also clean up that data.**

To enforce this, we use the `TestOrganizationDataManager` class which automatically registers cleanup handlers when you create test data.

## The Pattern

### ✅ Correct Usage

```typescript
import { TestOrganizationDataManager } from '../helpers/TestOrganizationDataManager';

describe('my feature tests', () => {
  it('should do something', async ({ task }) => {
    // Step 1: Create TestOrganizationDataManager with task.id
    const testData = new TestOrganizationDataManager(task.id);

    // Step 2: Create test data - cleanup is AUTOMATICALLY registered
    const { organization, adminUser } = await testData.createOrganization({
      users: { admin: 1, member: 2 },
    });

    // Step 3: Run your test logic
    await signInTestUser(adminUser.email);
    const result = await someApiCall(organization.id);
    expect(result).toBeDefined();

    // Step 4: Do nothing - cleanup happens automatically!
  });
});
```

## Benefits

1. **Automatic Cleanup**: You can't forget to clean up - it's baked into the data creation
2. **Consistent Pattern**: All tests follow the same structure
3. **Less Boilerplate**: No need to manually call `onTestFinished()`
4. **Type Safety**: The class provides better TypeScript support
5. **Extensibility**: Easy to add new test data creation methods

## Available Methods

### `createOrganization(opts?)`

Creates an organization with specified users and roles.

```typescript
const {
  organization, // The organization record
  organizationProfile, // The profile record
  adminUser, // First admin user (for convenience)
  adminUsers, // All admin users
  memberUsers, // All member users
  allUsers, // All users combined
} = await testData.createOrganization({
  users: {
    admin: 2, // Number of admins
    member: 3, // Number of members
  },
  organizationName: 'Test Org', // Optional custom name
});
```

### `generateUserWithRole(role)`

Generates a unique email for a test user.

```typescript
const { email, role } = testData.generateUserWithRole('Admin');
// Returns: { email: 'test-users-<task-id>-admin-<uuid>@oneproject.org', role: 'Admin' }
```

## Real-World Examples

### Example 1: Basic Organization Test

```typescript
it('should list all organization users', async ({ task }) => {
  const testData = new TestOrganizationDataManager(task.id);
  const { organization, adminUser, memberUsers } =
    await testData.createOrganization({
      users: { admin: 1, member: 3 },
    });

  await signInTestUser(adminUser.email);
  const session = await getCurrentTestSession();
  const caller = createCaller(createTestContext(session.access_token));

  const result = await caller.listUsers({ profileId: organization.profileId });

  expect(result).toHaveLength(4); // 1 admin + 3 members
  expect(result).toContainEqual(
    expect.objectContaining({
      email: adminUser.email,
    }),
  );
});
```

### Example 2: Multiple Roles Test

```typescript
it('should handle users with multiple roles', async ({ task }) => {
  const testData = new TestOrganizationDataManager(task.id);
  const { organization, adminUser } = await testData.createOrganization({
    users: { admin: 1 },
  });

  // Add additional role
  const memberRole = await db.query.accessRoles.findFirst({
    where: (table, { eq }) => eq(table.name, 'Member'),
  });

  await db.insert(organizationUserToAccessRoles).values({
    organizationUserId: adminUser.organizationUserId,
    accessRoleId: memberRole.id,
  });

  await signInTestUser(adminUser.email);
  const session = await getCurrentTestSession();
  const caller = createCaller(createTestContext(session.access_token));

  const result = await caller.listUsers({ profileId: organization.profileId });
  const user = result.find((u) => u.email === adminUser.email);

  expect(user.roles).toHaveLength(2);
  expect(user.roles).toContainEqual(expect.objectContaining({ name: 'Admin' }));
  expect(user.roles).toContainEqual(
    expect.objectContaining({ name: 'Member' }),
  );
});
```

### Example 3: Error Handling Test

```typescript
it('should throw error for invalid profile ID', async ({ task }) => {
  const testData = new TestOrganizationDataManager(task.id);
  const { adminUser } = await testData.createOrganization();

  await signInTestUser(adminUser.email);
  const session = await getCurrentTestSession();
  const caller = createCaller(createTestContext(session.access_token));

  await expect(async () => {
    await caller.listUsers({
      profileId: '00000000-0000-0000-0000-000000000000',
    });
  }).rejects.toThrow();
});
```

## Extending the Pattern

To add new test data creation methods:

1. Add the method to `TestOrganizationDataManager` class in `test/helpers/TestOrganizationDataManager.ts`
2. Call `this.ensureCleanupRegistered()` at the start
3. Use `this.testId` in resource names for automatic cleanup
4. Return the created resources

```typescript
async createCustomResource(opts): Promise<CustomResource> {
  this.ensureCleanupRegistered();

  const resource = await db.insert(resources).values({
    name: `test-resource-${this.testId}-${opts.name}`,
    // ... other fields
  }).returning();

  return resource;
}
```

## Files

- Implementation: `services/api/src/test/helpers/TestOrganizationDataManager.ts`
- Documentation: `services/api/src/test/helpers/README.md`
- Example: `services/api/src/test/integration/listUsers.integration.test.ts`
