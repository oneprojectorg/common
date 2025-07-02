import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { TRPCError } from '@trpc/server';
import { UnauthorizedError } from '@op/common';
import { createOrganizationRouter } from '../../routers/organization/createOrganization';

// Mock dependencies
jest.mock('@op/common', () => ({
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'UnauthorizedError';
    }
  },
  createOrganization: jest.fn()
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
  }
}));

jest.mock('../../routers/organization/validators', () => ({
  createOrganizationInputSchema: {
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
    mutation: jest.fn().mockReturnThis()
  },
  router: jest.fn((routes) => routes)
}));

describe('createOrganization Router', () => {
  let mockCreateOrganization: jest.MockedFunction<any>;
  let mockOrganizationsEncoder: any;
  let mockLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    const { createOrganization } = require('@op/common');
    const { organizationsEncoder } = require('../../encoders/organizations');
    
    mockCreateOrganization = createOrganization as jest.MockedFunction<any>;
    mockOrganizationsEncoder = organizationsEncoder;
    
    mockLogger = {
      info: jest.fn(),
      error: jest.fn()
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('create', () => {
    it('should be defined', () => {
      expect(createOrganizationRouter).toBeDefined();
      expect(createOrganizationRouter.create).toBeDefined();
    });

    it('should have correct middleware chain', () => {
      const { loggedProcedure } = require('../../trpcFactory');
      
      expect(loggedProcedure.use).toHaveBeenCalled();
      expect(loggedProcedure.meta).toHaveBeenCalled();
      expect(loggedProcedure.input).toHaveBeenCalled();
      expect(loggedProcedure.output).toHaveBeenCalled();
      expect(loggedProcedure.mutation).toHaveBeenCalled();
    });

    describe('mutation handler behavior', () => {
      let mutationHandler: any;
      const mockCtx = {
        user: { id: 'user-123', email: 'test@example.com' },
        database: { db: {} },
        logger: mockLogger
      };

      beforeEach(() => {
        // Extract the mutation handler from the mock calls
        const { loggedProcedure } = require('../../trpcFactory');
        const mutationCall = loggedProcedure.mutation.mock.calls.find((call: any) => call.length > 0);
        mutationHandler = mutationCall ? mutationCall[0] : null;
      });

      it('should successfully create organization with valid input', async () => {
        if (!mutationHandler) {
          throw new Error('Mutation handler not found');
        }

        const mockInput = {
          name: 'Test Organization',
          website: 'https://test.org',
          email: 'contact@test.org',
          orgType: 'nonprofit',
          bio: 'A test organization',
          mission: 'To test things',
          networkOrganization: false,
          isReceivingFunds: true,
          isOfferingFunds: false,
          acceptingApplications: true
        };

        const mockCreatedOrg = {
          id: 'org-123',
          profile: {
            name: 'Test Organization',
            email: 'contact@test.org'
          },
          ...mockInput
        };

        mockCreateOrganization.mockResolvedValue(mockCreatedOrg);
        mockOrganizationsEncoder.parse.mockReturnValue(mockCreatedOrg);

        const result = await mutationHandler({
          ctx: mockCtx,
          input: mockInput
        });

        expect(mockCreateOrganization).toHaveBeenCalledWith({
          data: mockInput,
          user: mockCtx.user
        });
        expect(mockLogger.info).toHaveBeenCalledWith('Organization created', {
          userId: mockCtx.user.id,
          organizationId: mockCreatedOrg.id,
          organizationName: mockCreatedOrg.profile.name
        });
        expect(mockOrganizationsEncoder.parse).toHaveBeenCalledWith(mockCreatedOrg);
        expect(result).toEqual(mockCreatedOrg);
      });

      it('should handle minimal valid input', async () => {
        if (!mutationHandler) {
          throw new Error('Mutation handler not found');
        }

        const mockMinimalInput = {
          website: 'https://minimal.org',
          orgType: 'nonprofit',
          bio: 'Minimal org'
        };

        const mockCreatedOrg = {
          id: 'org-minimal',
          profile: {
            name: 'Generated Name'
          }
        };

        mockCreateOrganization.mockResolvedValue(mockCreatedOrg);
        mockOrganizationsEncoder.parse.mockReturnValue(mockCreatedOrg);

        const result = await mutationHandler({
          ctx: mockCtx,
          input: mockMinimalInput
        });

        expect(mockCreateOrganization).toHaveBeenCalledWith({
          data: mockMinimalInput,
          user: mockCtx.user
        });
        expect(result).toEqual(mockCreatedOrg);
      });

      it('should handle input with optional arrays', async () => {
        if (!mutationHandler) {
          throw new Error('Mutation handler not found');
        }

        const mockInputWithArrays = {
          name: 'Complex Organization',
          website: 'https://complex.org',
          orgType: 'nonprofit',
          bio: 'Complex organization',
          focusAreas: [
            { id: 'area1', label: 'Education', isNewValue: false },
            { id: 'area2', label: 'Healthcare', isNewValue: true }
          ],
          strategies: [
            { id: 'strategy1', label: 'Direct Service', isNewValue: false }
          ],
          whereWeWork: [
            {
              id: 'location1',
              label: 'San Francisco',
              isNewValue: false,
              data: {
                id: 'sf-123',
                name: 'San Francisco',
                latitude: 37.7749,
                longitude: -122.4194
              }
            }
          ]
        };

        const mockCreatedOrg = {
          id: 'org-complex',
          profile: { name: 'Complex Organization' }
        };

        mockCreateOrganization.mockResolvedValue(mockCreatedOrg);
        mockOrganizationsEncoder.parse.mockReturnValue(mockCreatedOrg);

        const result = await mutationHandler({
          ctx: mockCtx,
          input: mockInputWithArrays
        });

        expect(mockCreateOrganization).toHaveBeenCalledWith({
          data: mockInputWithArrays,
          user: mockCtx.user
        });
        expect(result).toEqual(mockCreatedOrg);
      });

      it('should throw UNAUTHORIZED error when user lacks permission', async () => {
        if (!mutationHandler) {
          throw new Error('Mutation handler not found');
        }

        const mockInput = {
          name: 'Unauthorized Org',
          website: 'https://unauthorized.org',
          orgType: 'nonprofit',
          bio: 'Should not be created'
        };

        mockCreateOrganization.mockRejectedValue(new UnauthorizedError('Permission denied'));

        await expect(mutationHandler({
          ctx: mockCtx,
          input: mockInput
        })).rejects.toThrow('You do not have permission to create organizations');

        expect(mockCreateOrganization).toHaveBeenCalledWith({
          data: mockInput,
          user: mockCtx.user
        });
      });

      it('should throw INTERNAL_SERVER_ERROR for database errors', async () => {
        if (!mutationHandler) {
          throw new Error('Mutation handler not found');
        }

        const mockInput = {
          name: 'Database Error Org',
          website: 'https://db-error.org',
          orgType: 'nonprofit',
          bio: 'Will cause DB error'
        };

        const dbError = new Error('Database connection failed');
        mockCreateOrganization.mockRejectedValue(dbError);

        await expect(mutationHandler({
          ctx: mockCtx,
          input: mockInput
        })).rejects.toThrow('Failed to create organization');

        expect(mockCreateOrganization).toHaveBeenCalledWith({
          data: mockInput,
          user: mockCtx.user
        });
      });

      it('should throw INTERNAL_SERVER_ERROR for validation errors', async () => {
        if (!mutationHandler) {
          throw new Error('Mutation handler not found');
        }

        const mockInput = {
          name: 'Validation Error Org',
          website: 'https://validation-error.org',
          orgType: 'nonprofit',
          bio: 'Will cause validation error'
        };

        const validationError = new Error('Slug already exists');
        mockCreateOrganization.mockRejectedValue(validationError);

        await expect(mutationHandler({
          ctx: mockCtx,
          input: mockInput
        })).rejects.toThrow('Failed to create organization');
      });

      it('should log errors appropriately', async () => {
        if (!mutationHandler) {
          throw new Error('Mutation handler not found');
        }

        const mockInput = {
          name: 'Error Logging Test',
          website: 'https://error-log.org',
          orgType: 'nonprofit',
          bio: 'Test error logging'
        };

        const testError = new Error('Test error for logging');
        mockCreateOrganization.mockRejectedValue(testError);

        // Spy on console.error
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        try {
          await mutationHandler({
            ctx: mockCtx,
            input: mockInput
          });
        } catch (error) {
          // Expected to throw
        }

        expect(consoleSpy).toHaveBeenCalledWith('Failed to create organization', {
          userId: mockCtx.user.id,
          organizationName: mockInput.name,
          error: testError
        });

        consoleSpy.mockRestore();
      });

      it('should handle funding-related fields correctly', async () => {
        if (!mutationHandler) {
          throw new Error('Mutation handler not found');
        }

        const mockFundingInput = {
          name: 'Funding Organization',
          website: 'https://funding.org',
          orgType: 'foundation',
          bio: 'We provide funding',
          isOfferingFunds: true,
          isReceivingFunds: false,
          acceptingApplications: true,
          offeringFundsDescription: 'We offer grants for education',
          offeringFundsLink: 'https://funding.org/apply',
          receivingFundsTerms: [
            { id: 'term1', label: 'Education', isNewValue: false }
          ]
        };

        const mockCreatedOrg = {
          id: 'org-funding',
          profile: { name: 'Funding Organization' }
        };

        mockCreateOrganization.mockResolvedValue(mockCreatedOrg);
        mockOrganizationsEncoder.parse.mockReturnValue(mockCreatedOrg);

        const result = await mutationHandler({
          ctx: mockCtx,
          input: mockFundingInput
        });

        expect(mockCreateOrganization).toHaveBeenCalledWith({
          data: mockFundingInput,
          user: mockCtx.user
        });
        expect(result).toEqual(mockCreatedOrg);
      });

      it('should handle image upload fields', async () => {
        if (!mutationHandler) {
          throw new Error('Mutation handler not found');
        }

        const mockImageInput = {
          name: 'Organization with Images',
          website: 'https://images.org',
          orgType: 'nonprofit',
          bio: 'Organization with custom images',
          orgAvatarImageId: 'avatar-123',
          orgBannerImageId: 'banner-456'
        };

        const mockCreatedOrg = {
          id: 'org-images',
          profile: { name: 'Organization with Images' }
        };

        mockCreateOrganization.mockResolvedValue(mockCreatedOrg);
        mockOrganizationsEncoder.parse.mockReturnValue(mockCreatedOrg);

        const result = await mutationHandler({
          ctx: mockCtx,
          input: mockImageInput
        });

        expect(mockCreateOrganization).toHaveBeenCalledWith({
          data: mockImageInput,
          user: mockCtx.user
        });
        expect(result).toEqual(mockCreatedOrg);
      });
    });
  });
});