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