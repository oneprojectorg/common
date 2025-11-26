# Test Helpers

This directory contains utilities to help write consistent, maintainable integration tests.

## TestOrganizationDataManager

The `TestOrganizationDataManager` class provides a standardized pattern for managing test data lifecycle with automatic cleanup.
It's very early days so it's not an abstract class yet.

### Testing philosophy

- **No seed data**: Tests should not rely on seed data (except for roles). Each test creates its own data.
- **Isolated**: Tests should be fully isolated from each other and clean up after themselves.
- **Concurrent**: Tests should be able to run concurrently without interfering with each other.

The `TestOrganizationDataManager` handles creation and cleanup of test data to support these principles.

### Basic Usage

```typescript
import { TestOrganizationDataManager } from '../helpers/TestOrganizationDataManager';

describe('my feature', () => {
  it('should do something', async ({ task }) => {
    // Create test data manager
    const testData = new TestOrganizationDataManager(task.id);

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
