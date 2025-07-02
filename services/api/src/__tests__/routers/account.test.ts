import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TRPCError } from '@trpc/server';
import { createCallerFactory } from '@trpc/server';
import { getMyAccount } from '../../routers/account/getMyAccount';

// Mock the dependencies
jest.mock('@op/db/schema', () => ({
  users: {}
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

describe('Account Router', () => {
  describe('getMyAccount', () => {
    it('should be defined', () => {
      expect(getMyAccount).toBeDefined();
      expect(getMyAccount.getMyAccount).toBeDefined();
    });

    it('should have correct middleware chain', () => {
      const { loggedProcedure } = require('../../trpcFactory');
      
      // Verify middleware chain was called
      expect(loggedProcedure.use).toHaveBeenCalled();
      expect(loggedProcedure.meta).toHaveBeenCalled();
      expect(loggedProcedure.input).toHaveBeenCalled();
      expect(loggedProcedure.output).toHaveBeenCalled();
      expect(loggedProcedure.query).toHaveBeenCalled();
    });
  });
});