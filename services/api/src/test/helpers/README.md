# Test Helpers

This directory contains utilities to help write consistent, maintainable integration tests.

## TestDataManager

The `TestDataManager` class provides a standardized pattern for managing test data lifecycle with automatic cleanup.

### Why Use TestDataManager?

1. **Automatic Cleanup**: Cleanup is registered automatically when you create test data, eliminating the need for manual `onTestFinished()` calls
2. **Consistency**: Enforces a consistent pattern across all integration tests
3. **Safety**: Ensures test data is always cleaned up, preventing test pollution
4. **Simplicity**: Reduces boilerplate and makes tests easier to read

### Basic Usage

```typescript
import { TestDataManager } from '../helpers/test-data-manager';

describe('my feature', () => {
  it('should do something', async ({ task }) => {
    // Create test data manager
    const testData = new TestDataManager(task.id);

    // Create organization with users - cleanup is automatically registered
    const { organization, adminUser, memberUsers } =
      await testData.createOrganization({
        users: { admin: 1, member: 2 },
        organizationName: 'My Test Org',
      });

    // Your test logic here...

    // Cleanup happens automatically after test finishes
  });
});
```

### API Reference

#### Constructor

```typescript
new TestDataManager(testId: string)
```

- `testId`: Unique identifier for the test (use `task.id` from vitest)

#### Methods

##### `createOrganization(opts?)`

Creates a test organization with specified users and automatically registers cleanup.

```typescript
const { organization, adminUser, adminUsers, memberUsers, allUsers } =
  await testData.createOrganization({
    users: {
      admin: 2, // Number of admin users to create
      member: 3, // Number of member users to create
    },
    organizationName: 'Test Org', // Optional organization name
  });
```

**Returns:**

- `organization`: The created organization record
- `organizationProfile`: The organization's profile record
- `adminUser`: The first admin user (for convenience)
- `adminUsers`: Array of all admin users
- `memberUsers`: Array of all member users
- `allUsers`: Array of all users (admins + members)

**User Object Structure:**

```typescript
{
  authUserId: string;
  email: string;
  organizationUserId: string;
  role: 'Admin' | 'Member';
}
```

##### `generateUserWithRole(role)`

Generates a unique email for a test user with the specified role.

```typescript
const { email, role } = testData.generateUserWithRole('Admin');
// Returns: { email: 'test-users-123-admin-a1b2c3@oneproject.org', role: 'Admin' }
```

##### `cleanup()`

Manually triggers cleanup of test data. **You typically don't need to call this** as it's automatically registered via `onTestFinished()`.

```typescript
await testData.cleanup();
```

### Examples

#### Basic Test with Organization

```typescript
it('should list organization users', async ({ task }) => {
  const testData = new TestDataManager(task.id);
  const { organization, adminUser } = await testData.createOrganization({
    users: { admin: 1, member: 2 },
  });

  // Sign in as admin
  await signInTestUser(adminUser.email);

  // Test your logic
  const users = await getOrganizationUsers(organization.id);
  expect(users).toHaveLength(3);
});
```

#### Test with Multiple Roles

```typescript
it('should handle users with multiple roles', async ({ task }) => {
  const testData = new TestDataManager(task.id);
  const { organization, adminUser } = await testData.createOrganization({
    users: { admin: 1 },
  });

  // Add additional role to user
  const memberRole = await db.query.accessRoles.findFirst({
    where: (table, { eq }) => eq(table.name, 'Member'),
  });

  await db.insert(organizationUserToAccessRoles).values({
    organizationUserId: adminUser.organizationUserId,
    accessRoleId: memberRole.id,
  });

  // Test logic...
});
```

#### Custom Organization Name

```typescript
it('should handle custom organization names', async ({ task }) => {
  const testData = new TestDataManager(task.id);
  const { organization, organizationProfile } =
    await testData.createOrganization({
      organizationName: 'Acme Corp',
      users: { admin: 1 },
    });

  expect(organizationProfile.name).toContain('Acme Corp');
});
```

### Best Practices

1. **Always use `task.id`**: Pass `task.id` from vitest to ensure unique test identifiers
2. **One manager per test**: Create a new `TestDataManager` instance for each test
3. **Let it handle cleanup**: Don't manually call `cleanup()` or `onTestFinished()` - the manager handles this automatically
4. **Use descriptive names**: When creating organizations, use descriptive names to make debugging easier

### Extending TestDataManager

To add new test data creation methods:

1. Add the method to the `TestDataManager` class
2. Call `this.ensureCleanupRegistered()` at the start of the method
3. Use `this.testId` to generate unique identifiers
4. Return the created data

```typescript
async createCustomResource(): Promise<CustomResource> {
  this.ensureCleanupRegistered();

  // Create your resource using this.testId for uniqueness
  const resource = await db.insert(resources).values({
    name: `test-resource-${this.testId}`,
  }).returning();

  return resource;
}
```

The cleanup logic in the `cleanup()` method will automatically handle resources created with the test ID in their name.
