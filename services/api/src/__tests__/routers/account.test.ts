import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { TRPCError } from '@trpc/server';
import { CommonError, NotFoundError } from '@op/common';

// Mock dependencies
jest.mock('@op/common', () => ({
  CommonError: class CommonError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'CommonError';
    }
  },
  NotFoundError: class NotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NotFoundError';
    }
  }
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

// Mock the trpcFactory
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

// We'll dynamically import the routers to avoid module loading issues
describe('Account Routers', () => {
  let mockUserEncoder: any;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    const { userEncoder } = require('../../encoders');
    mockUserEncoder = userEncoder;
    
    mockDb = {
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
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getMyAccount', () => {
    let getMyAccount: any;
    
    beforeEach(async () => {
      const module = await import('../../routers/account/getMyAccount');
      getMyAccount = module.getMyAccount;
    });

    it('should be defined', () => {
      expect(getMyAccount).toBeDefined();
      expect(getMyAccount.getMyAccount).toBeDefined();
    });

    it('should have correct middleware chain', () => {
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
        database: { db: mockDb }
      };

      beforeEach(() => {
        const { loggedProcedure } = require('../../trpcFactory');
        const queryCall = loggedProcedure.query.mock.calls.find((call: any) => call.length > 0);
        queryHandler = queryCall ? queryCall[0] : null;
      });

      it('should successfully return user when found', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        const mockUser = {
          id: 'user-123',
          authUserId: 'auth-123',
          email: 'test@example.com',
          name: 'Test User',
          username: 'testuser',
          avatarImage: null,
          organizationUsers: [],
          currentOrganization: null
        };

        mockDb.query.users.findFirst.mockResolvedValue(mockUser);
        mockUserEncoder.parse.mockReturnValue(mockUser);

        const result = await queryHandler({
          ctx: mockCtx,
          input: undefined
        });

        expect(mockDb.query.users.findFirst).toHaveBeenCalledWith({
          where: expect.any(Function),
          with: {
            avatarImage: true,
            organizationUsers: {
              with: {
                organization: {
                  with: {
                    profile: {
                      with: {
                        avatarImage: true,
                      },
                    },
                  },
                },
              },
            },
            currentOrganization: {
              with: {
                profile: {
                  with: {
                    avatarImage: true,
                  },
                },
              },
            },
          },
        });
        expect(mockUserEncoder.parse).toHaveBeenCalledWith(mockUser);
        expect(result).toEqual(mockUser);
      });

      it('should create new user when user not found but has email', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        const mockNewUser = {
          id: 'new-user-123',
          authUserId: 'auth-123',
          email: 'test@example.com'
        };

        const mockNewUserWithRelations = {
          ...mockNewUser,
          avatarImage: null,
          organizationUsers: [],
          currentOrganization: null
        };

        // First call returns null (user not found)
        mockDb.query.users.findFirst
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(mockNewUserWithRelations);

        mockDb.insert().values().returning.mockResolvedValue([mockNewUser]);
        mockUserEncoder.parse.mockReturnValue(mockNewUserWithRelations);

        const result = await queryHandler({
          ctx: mockCtx,
          input: undefined
        });

        expect(mockDb.insert).toHaveBeenCalled();
        expect(mockUserEncoder.parse).toHaveBeenCalledWith(mockNewUserWithRelations);
        expect(result).toEqual(mockNewUserWithRelations);
      });

      it('should throw NotFoundError when user not found and no email', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        const mockCtxNoEmail = {
          user: { id: 'user-123', email: undefined },
          database: { db: mockDb }
        };

        mockDb.query.users.findFirst.mockResolvedValue(null);

        await expect(queryHandler({
          ctx: mockCtxNoEmail,
          input: undefined
        })).rejects.toThrow('Could not find user');
      });

      it('should throw CommonError when user creation fails', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        mockDb.query.users.findFirst.mockResolvedValue(null);
        mockDb.insert().values().returning.mockResolvedValue([]);

        await expect(queryHandler({
          ctx: mockCtx,
          input: undefined
        })).rejects.toThrow('Could not create user');
      });
    });
  });
});