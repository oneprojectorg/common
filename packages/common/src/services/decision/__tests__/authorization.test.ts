import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockDb } from '../../../test/setup';
import { UnauthorizedError } from '../../../utils';
import { getProcessCategories, listProposals } from '../index';

// Mock the access control functions
vi.mock('../../access', () => ({
  getCurrentOrgId: vi.fn(),
  getOrgAccessUser: vi.fn(),
}));

vi.mock('access-zones', () => ({
  assertAccess: vi.fn(),
  permission: {
    READ: 1,
  },
}));

const mockUser = {
  id: 'auth-user-id',
  email: 'test@example.com',
} as any;

const mockAuthUserId = 'auth-user-id';

describe('Decision Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listProposals', () => {
    it('should throw UnauthorizedError when user is not authenticated', async () => {
      await expect(
        listProposals({
          input: { processInstanceId: 'test-id', authUserId: mockAuthUserId },
          user: null as any,
        }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should call authorization check with decisions READ permission', async () => {
      const { assertAccess } = await import('access-zones');
      const { getCurrentOrgId, getOrgAccessUser } = await import(
        '../../access'
      );

      // Mock the access control functions to pass authorization
      vi.mocked(getCurrentOrgId).mockResolvedValue('org-id');
      vi.mocked(getOrgAccessUser).mockResolvedValue({
        id: 'org-user-id',
        roles: [{ access: { decisions: 1 } }], // READ permission
      } as any);

      // Mock database queries to avoid actual DB calls
      mockDb.query.users.findFirst = vi.fn().mockResolvedValue({
        id: 'user-id',
        currentProfileId: 'profile-id',
      });

      mockDb.execute = vi.fn().mockResolvedValue([]);

      try {
        await listProposals({
          input: { processInstanceId: 'test-id', authUserId: mockAuthUserId },
          user: mockUser,
        });
      } catch (error) {
        // We expect this to fail due to mocked DB, but authorization check should have been called
      }

      expect(assertAccess).toHaveBeenCalledWith(
        { decisions: 1 }, // permission.READ
        [{ access: { decisions: 1 } }], // user roles
      );
    });
  });

  describe('getProcessCategories', () => {
    it('should throw UnauthorizedError when user is not authenticated', async () => {
      await expect(
        getProcessCategories({
          processInstanceId: 'test-id',
          authUserId: mockAuthUserId,
          user: null as any,
        }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should call authorization check with decisions READ permission', async () => {
      const { assertAccess } = await import('access-zones');
      const { getCurrentOrgId, getOrgAccessUser } = await import(
        '../../access'
      );

      // Mock the access control functions to pass authorization
      vi.mocked(getCurrentOrgId).mockResolvedValue('org-id');
      vi.mocked(getOrgAccessUser).mockResolvedValue({
        id: 'org-user-id',
        roles: [{ access: { decisions: 1 } }], // READ permission
      } as any);

      // Mock database queries to avoid actual DB calls
      mockDb.query.processInstances.findFirst = vi.fn().mockResolvedValue({
        id: 'instance-id',
        process: { processSchema: { fields: { categories: [] } } },
      });

      try {
        await getProcessCategories({
          processInstanceId: 'test-id',
          authUserId: mockAuthUserId,
          user: mockUser,
        });
      } catch (error) {
        // We expect this to potentially fail due to mocked DB, but authorization check should have been called
      }

      expect(assertAccess).toHaveBeenCalledWith(
        { decisions: 1 }, // permission.READ
        [{ access: { decisions: 1 } }], // user roles
      );
    });
  });
});
