import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { TRPCError } from '@trpc/server';
import { UnauthorizedError } from '@op/common';
import { getOrganizationRouter } from '../../routers/organization/getOrganization';

// Mock dependencies
jest.mock('@op/cache', () => ({
  cache: jest.fn()
}));

jest.mock('@op/common', () => ({
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'UnauthorizedError';
    }
  },
  getOrganization: jest.fn(),
  getOrganizationTerms: jest.fn()
}));

jest.mock('../../middlewares/withAuthenticated', () => ({
  default: jest.fn()
}));

jest.mock('../../middlewares/withDB', () => ({
  default: jest.fn()
}));

jest.mock('../../middlewares/withRateLimited', () => ({
  default: jest.fn(() => jest.fn())
}));

jest.mock('../../encoders/organizations', () => ({
  organizationsEncoder: {
    parse: jest.fn((data) => data)
  },
  organizationsTermsEncoder: {
    parse: jest.fn((data) => data)
  }
}));

// Mock the trpcFactory
jest.mock('../../trpcFactory', () => ({
  loggedProcedure: {
    use: jest.fn().mockReturnThis(),
    meta: jest.fn().mockReturnThis(),
    input: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    query: jest.fn().mockReturnThis()
  },
  router: jest.fn((routes) => routes)
}));

describe('getOrganization Router', () => {
  let mockCache: jest.MockedFunction<any>;
  let mockGetOrganization: jest.MockedFunction<any>;
  let mockGetOrganizationTerms: jest.MockedFunction<any>;
  let mockOrganizationsEncoder: any;
  let mockOrganizationsTermsEncoder: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    const { cache } = require('@op/cache');
    const { getOrganization, getOrganizationTerms } = require('@op/common');
    const { organizationsEncoder, organizationsTermsEncoder } = require('../../encoders/organizations');
    
    mockCache = cache as jest.MockedFunction<any>;
    mockGetOrganization = getOrganization as jest.MockedFunction<any>;
    mockGetOrganizationTerms = getOrganizationTerms as jest.MockedFunction<any>;
    mockOrganizationsEncoder = organizationsEncoder;
    mockOrganizationsTermsEncoder = organizationsTermsEncoder;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getBySlug', () => {
    it('should be defined', () => {
      expect(getOrganizationRouter).toBeDefined();
      expect(getOrganizationRouter.getBySlug).toBeDefined();
    });

    it('should have correct middleware chain for getBySlug', () => {
      const { loggedProcedure } = require('../../trpcFactory');
      
      expect(loggedProcedure.use).toHaveBeenCalled();
      expect(loggedProcedure.meta).toHaveBeenCalled();
      expect(loggedProcedure.input).toHaveBeenCalled();
      expect(loggedProcedure.output).toHaveBeenCalled();
      expect(loggedProcedure.query).toHaveBeenCalled();
    });

    describe('query handler behavior', () => {
      let queryHandler: any;
      const mockCtx = {
        user: { id: 'user-123', email: 'test@example.com' },
        database: { db: {} }
      };

      beforeEach(() => {
        // Extract the query handler from the mock calls
        const { loggedProcedure } = require('../../trpcFactory');
        const queryCall = loggedProcedure.query.mock.calls.find((call: any) => call.length > 0);
        queryHandler = queryCall ? queryCall[0] : null;
      });

      it('should successfully return organization when found', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        const mockOrganization = {
          id: 'org-123',
          slug: 'test-org',
          profile: { name: 'Test Organization' }
        };

        mockCache.mockResolvedValue(mockOrganization);
        mockOrganizationsEncoder.parse.mockReturnValue(mockOrganization);

        const result = await queryHandler({
          ctx: mockCtx,
          input: { slug: 'test-org' }
        });

        expect(mockCache).toHaveBeenCalledWith({
          type: 'organization',
          params: ['test-org'],
          fetch: expect.any(Function)
        });
        expect(mockOrganizationsEncoder.parse).toHaveBeenCalledWith(mockOrganization);
        expect(result).toEqual(mockOrganization);
      });

      it('should throw NOT_FOUND error when organization does not exist', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        mockCache.mockResolvedValue(null);

        await expect(queryHandler({
          ctx: mockCtx,
          input: { slug: 'non-existent-org' }
        })).rejects.toThrow('Organization not found');
      });

      it('should throw UNAUTHORIZED error when user lacks access', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        mockCache.mockRejectedValue(new UnauthorizedError('Access denied'));

        await expect(queryHandler({
          ctx: mockCtx,
          input: { slug: 'restricted-org' }
        })).rejects.toThrow('You do not have acess to this organization');
      });

      it('should throw NOT_FOUND error for other errors', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        mockCache.mockRejectedValue(new Error('Database error'));

        await expect(queryHandler({
          ctx: mockCtx,
          input: { slug: 'error-org' }
        })).rejects.toThrow('Organization not found');
      });
    });
  });

  describe('getById', () => {
    it('should be defined', () => {
      expect(getOrganizationRouter.getById).toBeDefined();
    });

    describe('query handler behavior', () => {
      let queryHandler: any;
      const mockCtx = {
        user: { id: 'user-123', email: 'test@example.com' },
        database: { db: {} }
      };

      beforeEach(() => {
        // Extract the getById query handler (second query call)
        const { loggedProcedure } = require('../../trpcFactory');
        const queryCalls = loggedProcedure.query.mock.calls.filter((call: any) => call.length > 0);
        queryHandler = queryCalls[1] ? queryCalls[1][0] : null;
      });

      it('should successfully return organization when found by id', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        const mockOrganization = {
          id: 'org-123',
          profile: { name: 'Test Organization' }
        };

        mockCache.mockResolvedValue(mockOrganization);
        mockOrganizationsEncoder.parse.mockReturnValue(mockOrganization);

        const result = await queryHandler({
          ctx: mockCtx,
          input: { id: 'org-123' }
        });

        expect(mockCache).toHaveBeenCalledWith({
          type: 'organization',
          params: ['org-123'],
          fetch: expect.any(Function)
        });
        expect(result).toEqual(mockOrganization);
      });

      it('should throw UNAUTHORIZED error when user lacks access', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        mockCache.mockRejectedValue(new UnauthorizedError('Access denied'));

        await expect(queryHandler({
          ctx: mockCtx,
          input: { id: 'restricted-org' }
        })).rejects.toThrow('You do not have acess to this organization');
      });
    });
  });

  describe('getTerms', () => {
    it('should be defined', () => {
      expect(getOrganizationRouter.getTerms).toBeDefined();
    });

    describe('query handler behavior', () => {
      let queryHandler: any;
      const mockCtx = {
        user: { id: 'user-123', email: 'test@example.com' },
        database: { db: {} }
      };

      beforeEach(() => {
        // Extract the getTerms query handler (third query call)
        const { loggedProcedure } = require('../../trpcFactory');
        const queryCalls = loggedProcedure.query.mock.calls.filter((call: any) => call.length > 0);
        queryHandler = queryCalls[2] ? queryCalls[2][0] : null;
      });

      it('should successfully return organization terms when found', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        const mockTerms = {
          strategies: [{ id: 'term-1', label: 'Education' }],
          receivingFundsTerms: [{ id: 'term-2', label: 'Healthcare' }]
        };

        mockGetOrganizationTerms.mockResolvedValue(mockTerms);
        mockOrganizationsTermsEncoder.parse.mockReturnValue(mockTerms);

        const result = await queryHandler({
          ctx: mockCtx,
          input: { id: 'org-123' }
        });

        expect(mockGetOrganizationTerms).toHaveBeenCalledWith({
          organizationId: 'org-123',
          user: mockCtx.user
        });
        expect(mockOrganizationsTermsEncoder.parse).toHaveBeenCalledWith(mockTerms);
        expect(result).toEqual(mockTerms);
      });

      it('should throw NOT_FOUND error when terms do not exist', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        mockGetOrganizationTerms.mockResolvedValue(null);

        await expect(queryHandler({
          ctx: mockCtx,
          input: { id: 'org-without-terms' }
        })).rejects.toThrow('Organization terms not found');
      });

      it('should throw UNAUTHORIZED error when user lacks access to terms', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        mockGetOrganizationTerms.mockRejectedValue(new UnauthorizedError('Access denied'));

        await expect(queryHandler({
          ctx: mockCtx,
          input: { id: 'restricted-org' }
        })).rejects.toThrow('You do not have acess to this organization');
      });
    });
  });
});