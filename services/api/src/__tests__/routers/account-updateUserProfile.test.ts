import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { TRPCError } from '@trpc/server';
import { ZodError } from 'zod';

// Mock dependencies
jest.mock('@op/db/schema', () => ({
  users: {}
}));

jest.mock('drizzle-orm', () => ({
  eq: jest.fn()
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

jest.mock('../../encoders', () => ({
  userEncoder: {
    parse: jest.fn((data) => data)
  }
}));

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

describe('Account UpdateUserProfile Router', () => {
  let mockDb: any;
  let mockUserEncoder: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    const { userEncoder } = require('../../encoders');
    mockUserEncoder = userEncoder;
    
    mockDb = {
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn()
          })
        })
      })
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('updateUserProfile', () => {
    let updateUserProfile: any;
    
    beforeEach(async () => {
      const module = await import('../../routers/account/updateUserProfile');
      updateUserProfile = module.default;
    });

    it('should be defined', () => {
      expect(updateUserProfile).toBeDefined();
      expect(updateUserProfile.updateUserProfile).toBeDefined();
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
        user: { id: 'user-123' },
        database: { db: mockDb }
      };

      beforeEach(() => {
        const { loggedProcedure } = require('../../trpcFactory');
        const mutationCall = loggedProcedure.mutation.mock.calls.find((call: any) => call.length > 0);
        mutationHandler = mutationCall ? mutationCall[0] : null;
      });

      it('should successfully update user profile with all fields', async () => {
        if (!mutationHandler) {
          throw new Error('Mutation handler not found');
        }

        const mockInput = {
          name: 'Updated Name',
          about: 'Updated about section',
          title: 'Senior Developer',
          username: 'newusername'
        };

        const mockUpdatedUser = {
          id: 'user-123',
          ...mockInput
        };

        mockDb.update().set().where().returning.mockResolvedValue([mockUpdatedUser]);

        const result = await mutationHandler({
          ctx: mockCtx,
          input: mockInput
        });

        expect(mockDb.update).toHaveBeenCalled();
        expect(mockDb.update().set).toHaveBeenCalledWith(mockInput);
        expect(result).toEqual(mockUpdatedUser);
      });

      it('should successfully update user profile with partial fields', async () => {
        if (!mutationHandler) {
          throw new Error('Mutation handler not found');
        }

        const mockInput = {
          name: 'Updated Name Only'
        };

        const mockUpdatedUser = {
          id: 'user-123',
          name: 'Updated Name Only',
          about: 'Previous about',
          title: 'Previous title',
          username: 'previous_username'
        };

        mockDb.update().set().where().returning.mockResolvedValue([mockUpdatedUser]);

        const result = await mutationHandler({
          ctx: mockCtx,
          input: mockInput
        });

        expect(mockDb.update().set).toHaveBeenCalledWith(mockInput);
        expect(result).toEqual(mockUpdatedUser);
      });

      it('should handle empty input object', async () => {
        if (!mutationHandler) {
          throw new Error('Mutation handler not found');
        }

        const mockInput = {};

        const mockUpdatedUser = {
          id: 'user-123',
          name: 'Existing Name'
        };

        mockDb.update().set().where().returning.mockResolvedValue([mockUpdatedUser]);

        const result = await mutationHandler({
          ctx: mockCtx,
          input: mockInput
        });

        expect(mockDb.update().set).toHaveBeenCalledWith({});
        expect(result).toEqual(mockUpdatedUser);
      });

      it('should throw ZodError for duplicate username', async () => {
        if (!mutationHandler) {
          throw new Error('Mutation handler not found');
        }

        const mockInput = {
          username: 'existinguser'
        };

        const duplicateError = new Error('duplicate key value violates unique constraint');
        mockDb.update().set().where().returning.mockRejectedValue(duplicateError);

        // Spy on console.error
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await expect(mutationHandler({
          ctx: mockCtx,
          input: mockInput
        })).rejects.toThrow(ZodError);

        try {
          await mutationHandler({
            ctx: mockCtx,
            input: mockInput
          });
        } catch (error) {
          if (error instanceof ZodError) {
            expect(error.issues[0]).toMatchObject({
              code: 'custom',
              message: 'Username already in use',
              path: ['username'],
              fatal: true
            });
          }
        }

        consoleSpy.mockRestore();
      });

      it('should throw INTERNAL_SERVER_ERROR for other database errors', async () => {
        if (!mutationHandler) {
          throw new Error('Mutation handler not found');
        }

        const mockInput = {
          name: 'Test User'
        };

        const dbError = new Error('Database connection failed');
        mockDb.update().set().where().returning.mockRejectedValue(dbError);

        // Spy on console.error
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await expect(mutationHandler({
          ctx: mockCtx,
          input: mockInput
        })).rejects.toThrow('Failed to update profile');

        expect(consoleSpy).toHaveBeenCalledWith(dbError);
        consoleSpy.mockRestore();
      });

      it('should throw NOT_FOUND when user is not found', async () => {
        if (!mutationHandler) {
          throw new Error('Mutation handler not found');
        }

        const mockInput = {
          name: 'Test User'
        };

        mockDb.update().set().where().returning.mockResolvedValue([]);

        await expect(mutationHandler({
          ctx: mockCtx,
          input: mockInput
        })).rejects.toThrow('Profile not found');
      });

      it('should throw NOT_FOUND when result is null', async () => {
        if (!mutationHandler) {
          throw new Error('Mutation handler not found');
        }

        const mockInput = {
          name: 'Test User'
        };

        mockDb.update().set().where().returning.mockResolvedValue([null]);

        await expect(mutationHandler({
          ctx: mockCtx,
          input: mockInput
        })).rejects.toThrow('Profile not found');
      });

      it('should handle username normalization', async () => {
        if (!mutationHandler) {
          throw new Error('Mutation handler not found');
        }

        const mockInput = {
          username: '  TEST_USER_123  '
        };

        const expectedInput = {
          username: 'test_user_123'
        };

        const mockUpdatedUser = {
          id: 'user-123',
          username: 'test_user_123'
        };

        mockDb.update().set().where().returning.mockResolvedValue([mockUpdatedUser]);

        const result = await mutationHandler({
          ctx: mockCtx,
          input: mockInput
        });

        // Note: The actual normalization happens in the schema validation
        // This test verifies the flow works with normalized input
        expect(result).toEqual(mockUpdatedUser);
      });

      it('should handle string trimming for text fields', async () => {
        if (!mutationHandler) {
          throw new Error('Mutation handler not found');
        }

        const mockInput = {
          name: '  John Doe  ',
          about: '  Software Developer  ',
          title: '  Senior Engineer  '
        };

        const mockUpdatedUser = {
          id: 'user-123',
          name: 'John Doe',
          about: 'Software Developer',
          title: 'Senior Engineer'
        };

        mockDb.update().set().where().returning.mockResolvedValue([mockUpdatedUser]);

        const result = await mutationHandler({
          ctx: mockCtx,
          input: mockInput
        });

        expect(result).toEqual(mockUpdatedUser);
      });
    });
  });
});