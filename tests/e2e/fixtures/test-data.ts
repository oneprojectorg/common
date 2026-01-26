/**
 * E2E Test Data Utilities
 *
 * Re-exports shared test data functions from @op/test-core.
 * These are used by E2E fixtures to create test organizations and users.
 */
export {
  addUserToOrganization,
  createOrganization,
  createUser,
  generateTestEmail,
  TEST_USER_DEFAULT_PASSWORD,
  type CreateOrganizationOptions,
  type CreateOrganizationResult,
  type CreateUserOptions,
  type CreateUserResult,
  type GeneratedUser,
} from '@op/test';
