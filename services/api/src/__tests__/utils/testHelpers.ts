import { jest } from '@jest/globals';

// Test data factory functions
export const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  ...overrides
});

export const createMockOrganization = (overrides = {}) => ({
  id: 'org-123',
  slug: 'test-org',
  isOfferingFunds: false,
  isReceivingFunds: true,
  acceptingApplications: true,
  networkOrganization: false,
  orgType: 'nonprofit',
  profile: {
    id: 'profile-123',
    name: 'Test Organization',
    bio: 'A test organization',
    email: 'org@example.com',
    website: 'https://example.com'
  },
  projects: [],
  links: [],
  whereWeWork: [],
  receivingFundsTerms: [],
  strategies: [],
  headerImage: null,
  avatarImage: null,
  ...overrides
});

export const createMockOrganizationTerms = (overrides = {}) => ({
  strategies: [
    {
      id: 'term-1',
      termUri: 'http://example.com/term/education',
      taxonomyUri: 'http://example.com/taxonomy/strategies',
      label: 'Education',
      facet: 'primary'
    }
  ],
  receivingFundsTerms: [
    {
      id: 'term-2',
      termUri: 'http://example.com/term/healthcare',
      taxonomyUri: 'http://example.com/taxonomy/funds',
      label: 'Healthcare',
      facet: 'secondary'
    }
  ],
  ...overrides
});

export const createMockContext = (overrides = {}) => ({
  user: createMockUser(),
  database: { db: {} },
  ...overrides
});

// Mock function helpers
export const createMockProcedure = () => ({
  use: jest.fn().mockReturnThis(),
  meta: jest.fn().mockReturnThis(),
  input: jest.fn().mockReturnThis(),
  output: jest.fn().mockReturnThis(),
  query: jest.fn().mockReturnThis(),
  mutation: jest.fn().mockReturnThis()
});

// Error simulation helpers
export const simulateUnauthorizedError = () => {
  const { UnauthorizedError } = require('@op/common');
  return new UnauthorizedError('Access denied');
};

export const simulateNotFoundError = () => {
  return null;
};

export const simulateDatabaseError = () => {
  return new Error('Database connection failed');
};

// Assertion helpers
export const expectTRPCError = (promise: Promise<any>, code: string, message?: string) => {
  return expect(promise).rejects.toMatchObject({
    code,
    ...(message && { message })
  });
};

// Create organization test data factories
export const createMockCreateOrganizationInput = (overrides = {}) => ({
  name: 'Test Organization',
  website: 'https://test.org',
  email: 'contact@test.org',
  orgType: 'nonprofit',
  bio: 'A test organization for testing purposes',
  mission: 'To make testing better',
  networkOrganization: false,
  isReceivingFunds: true,
  isOfferingFunds: false,
  acceptingApplications: true,
  focusAreas: [
    {
      id: 'education',
      label: 'Education',
      isNewValue: false
    }
  ],
  strategies: [
    {
      id: 'direct-service',
      label: 'Direct Service',
      isNewValue: false
    }
  ],
  whereWeWork: [
    {
      id: 'location-1',
      label: 'San Francisco',
      isNewValue: false,
      data: {
        id: 'sf-123',
        name: 'San Francisco',
        latitude: 37.7749,
        longitude: -122.4194
      }
    }
  ],
  ...overrides
});

export const createMockMinimalOrganizationInput = (overrides = {}) => ({
  website: 'https://minimal.org',
  orgType: 'nonprofit',
  bio: 'Minimal organization',
  ...overrides
});

export const createMockCreatedOrganization = (overrides = {}) => ({
  id: 'org-123',
  slug: 'test-organization',
  isOfferingFunds: false,
  isReceivingFunds: true,
  acceptingApplications: true,
  networkOrganization: false,
  orgType: 'nonprofit',
  profile: {
    id: 'profile-123',
    name: 'Test Organization',
    bio: 'A test organization for testing purposes',
    email: 'contact@test.org',
    website: 'https://test.org',
    mission: 'To make testing better'
  },
  projects: [],
  links: [],
  whereWeWork: [],
  receivingFundsTerms: [],
  strategies: [],
  headerImage: null,
  avatarImage: null,
  ...overrides
});

// Validation error helpers
export const createValidationError = (field: string, message: string) => {
  const error = new Error(`Validation failed`);
  (error as any).issues = [{ path: [field], message }];
  return error;
};

// Mock logger
export const createMockLogger = () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
});

// Account test data factories
export const createMockUserProfile = (overrides = {}) => ({
  id: 'user-123',
  authUserId: 'auth-123',
  email: 'test@example.com',
  name: 'Test User',
  username: 'testuser',
  about: 'Software developer',
  title: 'Senior Engineer',
  lastOrgId: null,
  avatarImage: null,
  organizationUsers: [],
  currentOrganization: null,
  ...overrides
});

export const createMockUpdateProfileInput = (overrides = {}) => ({
  name: 'Updated Name',
  about: 'Updated about section',
  title: 'Updated Title',
  username: 'updateduser',
  ...overrides
});

export const createMockLoginInput = (overrides = {}) => ({
  email: 'user@example.com',
  usingOAuth: false,
  ...overrides
});

export const createMockStorageUsage = (overrides = {}) => ({
  usedStorage: 1500000000,
  maxStorage: 4000000000,
  ...overrides
});

export const createMockSupabaseClient = () => ({
  auth: {
    signInWithOtp: jest.fn().mockResolvedValue({ error: null })
  }
});

export const createMockDatabase = () => ({
  query: {
    users: {
      findFirst: jest.fn()
    }
  },
  insert: jest.fn().mockReturnValue({
    values: jest.fn().mockReturnValue({
      returning: jest.fn()
    })
  }),
  update: jest.fn().mockReturnValue({
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn()
      })
    })
  }),
  select: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn()
      })
    })
  })
});

// Username validation helpers
export const createValidUsername = () => 'valid_user_123';
export const createInvalidUsername = () => 'Invalid-User!@#';
export const createTooLongUsername = () => 'x'.repeat(256);
export const createTooShortUsername = () => 'abc';

// Email validation helpers
export const createValidEmail = () => 'user@example.com';
export const createInvalidEmail = () => 'invalid-email';
export const createAdminEmail = () => 'admin@test.com';
export const createAllowedDomainEmail = () => 'user@allowed.com';
export const createBlockedDomainEmail = () => 'user@blocked.com';