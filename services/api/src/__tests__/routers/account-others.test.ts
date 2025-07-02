import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { TRPCError } from '@trpc/server';

// Mock dependencies
jest.mock('@op/db/schema', () => ({
  users: {},
  organizationUsers: {},
  usersUsedStorage: {}
}));

jest.mock('drizzle-orm', () => ({
  eq: jest.fn(),
  and: jest.fn(),
  sql: jest.fn()
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
    query: jest.fn().mockReturnThis(),
    mutation: jest.fn().mockReturnThis()
  },
  router: jest.fn((routes) => routes)
}));

describe('Account Other Routers', () => {
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
      }),
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn()
          })
        })
      })
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('usernameAvailable', () => {
    let usernameAvailable: any;
    
    beforeEach(async () => {
      const module = await import('../../routers/account/usernameAvailable');
      usernameAvailable = module.default;
    });

    it('should be defined', () => {
      expect(usernameAvailable).toBeDefined();
      expect(usernameAvailable.usernameAvailable).toBeDefined();
    });

    describe('query handler behavior', () => {
      let queryHandler: any;
      const mockCtx = {
        database: { db: mockDb }
      };

      beforeEach(() => {
        const { loggedProcedure } = require('../../trpcFactory');
        const queryCall = loggedProcedure.query.mock.calls.find((call: any) => call.length > 0);
        queryHandler = queryCall ? queryCall[0] : null;
      });

      it('should return available true for empty username', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        const result = await queryHandler({
          ctx: mockCtx,
          input: { username: '' }
        });

        expect(result).toEqual({ available: true });
        expect(mockDb.select).not.toHaveBeenCalled();
      });

      it('should return available true when username is not taken', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        mockDb.select().from().where().limit.mockResolvedValue([]);

        const result = await queryHandler({
          ctx: mockCtx,
          input: { username: 'newuser' }
        });

        expect(result).toEqual({ available: true });
        expect(mockDb.select).toHaveBeenCalled();
      });

      it('should return available false when username is taken', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        mockDb.select().from().where().limit.mockResolvedValue([{ exists: true }]);

        const result = await queryHandler({
          ctx: mockCtx,
          input: { username: 'existinguser' }
        });

        expect(result).toEqual({ available: false });
      });

      it('should handle null result as available', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        mockDb.select().from().where().limit.mockResolvedValue([null]);

        const result = await queryHandler({
          ctx: mockCtx,
          input: { username: 'testuser' }
        });

        expect(result).toEqual({ available: true });
      });
    });
  });

  describe('switchOrganization', () => {
    let switchOrganization: any;
    
    beforeEach(async () => {
      const module = await import('../../routers/account/updateLastOrgId');
      switchOrganization = module.switchOrganization;
    });

    it('should be defined', () => {
      expect(switchOrganization).toBeDefined();
      expect(switchOrganization.switchOrganization).toBeDefined();
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

      it('should successfully switch organization', async () => {
        if (!mutationHandler) {
          throw new Error('Mutation handler not found');
        }

        const mockInput = {
          organizationId: 'org-456'
        };

        const mockUpdatedUser = {
          id: 'user-123',
          lastOrgId: 'org-456'
        };

        mockDb.update().set().where().returning.mockResolvedValue([mockUpdatedUser]);
        mockUserEncoder.parse.mockReturnValue(mockUpdatedUser);

        const result = await mutationHandler({
          ctx: mockCtx,
          input: mockInput
        });

        expect(mockDb.update().set).toHaveBeenCalledWith({ lastOrgId: 'org-456' });
        expect(mockUserEncoder.parse).toHaveBeenCalledWith(mockUpdatedUser);
        expect(result).toEqual(mockUpdatedUser);
      });

      it('should throw INTERNAL_SERVER_ERROR on database error', async () => {
        if (!mutationHandler) {
          throw new Error('Mutation handler not found');
        }

        const mockInput = {
          organizationId: 'org-456'
        };

        const dbError = new Error('Database error');
        mockDb.update().set().where().returning.mockRejectedValue(dbError);

        // Spy on console.error
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await expect(mutationHandler({
          ctx: mockCtx,
          input: mockInput
        })).rejects.toThrow('Failed to update lastOrgId');

        consoleSpy.mockRestore();
      });

      it('should throw NOT_FOUND when user is not found', async () => {
        if (!mutationHandler) {
          throw new Error('Mutation handler not found');
        }

        const mockInput = {
          organizationId: 'org-456'
        };

        mockDb.update().set().where().returning.mockResolvedValue([]);

        await expect(mutationHandler({
          ctx: mockCtx,
          input: mockInput
        })).rejects.toThrow('User not found');
      });
    });
  });

  describe('usedStorage', () => {
    let usedStorage: any;
    
    beforeEach(async () => {
      const module = await import('../../routers/account/usedStorage');
      usedStorage = module.default;
    });

    it('should be defined', () => {
      expect(usedStorage).toBeDefined();
      expect(usedStorage.usedStorage).toBeDefined();
    });

    describe('query handler behavior', () => {
      let queryHandler: any;
      const mockCtx = {
        user: { id: 'user-123' },
        database: { db: mockDb }
      };

      beforeEach(() => {
        const { loggedProcedure } = require('../../trpcFactory');
        const queryCall = loggedProcedure.query.mock.calls.find((call: any) => call.length > 0);
        queryHandler = queryCall ? queryCall[0] : null;
      });

      it('should return default storage when no usage record exists', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        mockDb.select().from().where().limit.mockResolvedValue([]);

        const result = await queryHandler({
          ctx: mockCtx,
          input: undefined
        });

        expect(result).toEqual({
          usedStorage: 0,
          maxStorage: 4000000000
        });
      });

      it('should return actual storage usage when record exists', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        mockDb.select().from().where().limit.mockResolvedValue([{
          totalSize: '1500000000'
        }]);

        const result = await queryHandler({
          ctx: mockCtx,
          input: undefined
        });

        expect(result).toEqual({
          usedStorage: 1500000000,
          maxStorage: 4000000000
        });
      });

      it('should handle null storage record', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        mockDb.select().from().where().limit.mockResolvedValue([null]);

        const result = await queryHandler({
          ctx: mockCtx,
          input: undefined
        });

        expect(result).toEqual({
          usedStorage: 0,
          maxStorage: 4000000000
        });
      });

      it('should parse totalSize as integer', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        mockDb.select().from().where().limit.mockResolvedValue([{
          totalSize: '2500000000'
        }]);

        const result = await queryHandler({
          ctx: mockCtx,
          input: undefined
        });

        expect(result.usedStorage).toBe(2500000000);
        expect(typeof result.usedStorage).toBe('number');
      });
    });
  });
});