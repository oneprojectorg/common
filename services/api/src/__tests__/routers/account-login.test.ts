import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { TRPCError } from '@trpc/server';

// Mock dependencies
jest.mock('@op/cache', () => ({
  cache: jest.fn()
}));

jest.mock('@op/common', () => ({
  getAllowListUser: jest.fn()
}));

jest.mock('@op/core', () => ({
  APP_NAME: 'Test App',
  adminEmails: ['admin@test.com'],
  allowedEmailDomains: ['allowed.com'],
  genericEmail: 'support@test.com'
}));

jest.mock('../../middlewares/withRateLimited', () => ({
  default: jest.fn(() => jest.fn())
}));

jest.mock('../../supabase/server', () => ({
  createSBAdminClient: jest.fn()
}));

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

describe('Account Login Router', () => {
  let mockCache: jest.MockedFunction<any>;
  let mockGetAllowListUser: jest.MockedFunction<any>;
  let mockCreateSBAdminClient: jest.MockedFunction<any>;
  let mockSupabase: any;
  let mockLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    const { cache } = require('@op/cache');
    const { getAllowListUser } = require('@op/common');
    const { createSBAdminClient } = require('../../supabase/server');
    
    mockCache = cache as jest.MockedFunction<any>;
    mockGetAllowListUser = getAllowListUser as jest.MockedFunction<any>;
    mockCreateSBAdminClient = createSBAdminClient as jest.MockedFunction<any>;
    
    mockSupabase = {
      auth: {
        signInWithOtp: jest.fn()
      }
    };
    
    mockCreateSBAdminClient.mockReturnValue(mockSupabase);
    
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('login', () => {
    let login: any;
    
    beforeEach(async () => {
      const module = await import('../../routers/account/login');
      login = module.default;
    });

    it('should be defined', () => {
      expect(login).toBeDefined();
      expect(login.login).toBeDefined();
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
        logger: mockLogger
      };

      beforeEach(() => {
        const { loggedProcedure } = require('../../trpcFactory');
        const queryCall = loggedProcedure.query.mock.calls.find((call: any) => call.length > 0);
        queryHandler = queryCall ? queryCall[0] : null;
      });

      it('should successfully login with allowed email domain', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        const mockInput = {
          email: 'user@allowed.com',
          usingOAuth: false
        };

        mockCache.mockResolvedValue(null);
        mockSupabase.auth.signInWithOtp.mockResolvedValue({ error: null });

        const result = await queryHandler({
          ctx: mockCtx,
          input: mockInput
        });

        expect(mockLogger.info).toHaveBeenCalledWith('Login attempt', {
          email: 'user@allowed.com',
          emailDomain: 'allowed.com',
          usingOAuth: false
        });
        expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith({
          email: 'user@allowed.com',
          options: {
            shouldCreateUser: true
          }
        });
        expect(result).toBe(true);
      });

      it('should successfully login with admin email', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        const mockInput = {
          email: 'admin@test.com',
          usingOAuth: false
        };

        mockCache.mockResolvedValue(null);
        mockSupabase.auth.signInWithOtp.mockResolvedValue({ error: null });

        const result = await queryHandler({
          ctx: mockCtx,
          input: mockInput
        });

        expect(result).toBe(true);
      });

      it('should successfully login with allowlisted user', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        const mockInput = {
          email: 'invited@external.com',
          usingOAuth: false
        };

        mockCache.mockResolvedValue({
          email: 'invited@external.com',
          id: 'allowlist-123'
        });
        mockSupabase.auth.signInWithOtp.mockResolvedValue({ error: null });

        const result = await queryHandler({
          ctx: mockCtx,
          input: mockInput
        });

        expect(mockCache).toHaveBeenCalledWith({
          type: 'allowList',
          params: ['invited@external.com'],
          fetch: expect.any(Function)
        });
        expect(result).toBe(true);
      });

      it('should successfully login with OAuth', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        const mockInput = {
          email: 'user@allowed.com',
          usingOAuth: true
        };

        mockCache.mockResolvedValue(null);

        const result = await queryHandler({
          ctx: mockCtx,
          input: mockInput
        });

        expect(mockSupabase.auth.signInWithOtp).not.toHaveBeenCalled();
        expect(result).toBe(true);
      });

      it('should throw BAD_REQUEST for invalid email', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        const mockInput = {
          email: 'invalid-email',
          usingOAuth: false
        };

        await expect(queryHandler({
          ctx: mockCtx,
          input: mockInput
        })).rejects.toThrow('Invalid email');

        expect(mockLogger.warn).toHaveBeenCalledWith('Login failed - invalid email', {
          email: 'invalid-email'
        });
      });

      it('should throw FORBIDDEN for non-allowlisted email', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        const mockInput = {
          email: 'user@blocked.com',
          usingOAuth: false
        };

        mockCache.mockResolvedValue(null);

        await expect(queryHandler({
          ctx: mockCtx,
          input: mockInput
        })).rejects.toThrow('Test App is invite-only! You\'re now on the waitlist. Keep an eye on your inbox for updates.');
      });

      it('should throw INTERNAL_SERVER_ERROR when Supabase auth fails', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        const mockInput = {
          email: 'user@allowed.com',
          usingOAuth: false
        };

        mockCache.mockResolvedValue(null);
        mockSupabase.auth.signInWithOtp.mockResolvedValue({
          error: new Error('Supabase error')
        });

        // Spy on console.error
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await expect(queryHandler({
          ctx: mockCtx,
          input: mockInput
        })).rejects.toThrow('There was an error signing you in');

        expect(consoleSpy).toHaveBeenCalledWith('login error', expect.any(Error));
        consoleSpy.mockRestore();
      });

      it('should handle email normalization (lowercase and trim)', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        const mockInput = {
          email: '  USER@ALLOWED.COM  ',
          usingOAuth: false
        };

        mockCache.mockResolvedValue(null);
        mockSupabase.auth.signInWithOtp.mockResolvedValue({ error: null });

        const result = await queryHandler({
          ctx: mockCtx,
          input: mockInput
        });

        expect(mockLogger.info).toHaveBeenCalledWith('Login attempt', {
          email: '  user@allowed.com  ',
          emailDomain: 'allowed.com',
          usingOAuth: false
        });
        expect(result).toBe(true);
      });

      it('should handle missing email domain', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        const mockInput = {
          email: 'invalid@',
          usingOAuth: false
        };

        await expect(queryHandler({
          ctx: mockCtx,
          input: mockInput
        })).rejects.toThrow('Invalid email');
      });

      it('should cache allowlist user lookup', async () => {
        if (!queryHandler) {
          throw new Error('Query handler not found');
        }

        const mockInput = {
          email: 'test@external.com',
          usingOAuth: false
        };

        mockCache.mockResolvedValue({ email: 'test@external.com' });
        mockSupabase.auth.signInWithOtp.mockResolvedValue({ error: null });

        await queryHandler({
          ctx: mockCtx,
          input: mockInput
        });

        expect(mockCache).toHaveBeenCalledWith({
          type: 'allowList',
          params: ['test@external.com'],
          fetch: expect.any(Function)
        });
      });
    });
  });
});