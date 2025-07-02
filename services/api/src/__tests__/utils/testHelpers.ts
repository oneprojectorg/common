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