import { describe, expect, it, vi, beforeEach } from 'vitest';
import { deleteProposal } from '../deleteProposal';
import { UnauthorizedError, NotFoundError, ValidationError, CommonError } from '../../../utils';
import { mockDb } from '../../../test/setup';

// Mock the access-zones module
vi.mock('access-zones', () => ({
  checkPermission: vi.fn(),
  permission: {
    ADMIN: 'admin',
  },
}));

const mockUser = {
  id: 'auth-user-id',
  email: 'test@example.com',
} as any;

const mockDbUser = {
  id: 'db-user-id',
  currentProfileId: 'profile-id-123',
  authUserId: 'auth-user-id',
};

const mockProcessOwnerProfile = 'process-owner-profile-id';
const mockOrganization = {
  id: 'org-id-123',
  profileId: mockProcessOwnerProfile,
};

const mockExistingProposal = {
  id: 'proposal-id-123',
  processInstanceId: 'instance-id-123',
  proposalData: { title: 'Test Proposal' },
  submittedByProfileId: 'profile-id-123',
  status: 'draft',
  processInstance: {
    id: 'instance-id-123',
    ownerProfileId: mockProcessOwnerProfile,
  },
  decisions: [],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockOrgUser = {
  id: 'org-user-id-123',
  roles: [],
};

describe('deleteProposal', () => {
  let mockCheckPermission: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Get the mocked function
    mockCheckPermission = vi.mocked(require('access-zones').checkPermission);

    // Default to no admin permissions
    mockCheckPermission.mockReturnValue(false);

    // Default mock organization and org user setup
    mockDb.query.organizations.findFirst.mockResolvedValue(mockOrganization);

    // Mock getOrgAccessUser to return mockOrgUser
    vi.doMock('../../../services/access', () => ({
      getOrgAccessUser: vi.fn().mockResolvedValue(mockOrgUser),
    }));
  });

  it('should delete proposal successfully by submitter', async () => {
    const mockDeletedProposal = {
      id: 'proposal-id-123',
      processInstanceId: 'instance-id-123',
    };

    mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb.query.proposals.findFirst.mockResolvedValueOnce(mockExistingProposal as any);
    mockDb.delete.mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([mockDeletedProposal]),
      }),
    } as any);

    const result = await deleteProposal({
      proposalId: 'proposal-id-123',
      user: mockUser,
    });

    expect(result).toEqual({
      success: true,
      deletedId: 'proposal-id-123',
    });

    expect(mockDb.query.users.findFirst).toHaveBeenCalled();
    expect(mockDb.query.proposals.findFirst).toHaveBeenCalled();
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it('should delete proposal successfully by process owner', async () => {
    const processOwnerDbUser = {
      ...mockDbUser,
      currentProfileId: mockProcessOwnerProfile,
    };

    const mockDeletedProposal = {
      id: 'proposal-id-123',
    };

    mockDb.query.users.findFirst.mockResolvedValueOnce(processOwnerDbUser);
    mockDb.query.proposals.findFirst.mockResolvedValueOnce(mockExistingProposal as any);
    mockDb.delete.mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([mockDeletedProposal]),
      }),
    } as any);

    const result = await deleteProposal({
      proposalId: 'proposal-id-123',
      user: mockUser,
    });

    expect(result.success).toBe(true);
    expect(result.deletedId).toBe('proposal-id-123');
  });

  it('should delete proposal successfully by admin user (non-owner)', async () => {
    // User is not the submitter or process owner, but has admin permissions
    const adminDbUser = {
      ...mockDbUser,
      currentProfileId: 'admin-profile-id',
    };

    const mockDeletedProposal = {
      id: 'proposal-id-123',
    };

    // Mock admin permissions
    mockCheckPermission.mockReturnValue(true);

    mockDb.query.users.findFirst.mockResolvedValueOnce(adminDbUser);
    mockDb.query.proposals.findFirst.mockResolvedValueOnce(mockExistingProposal as any);
    mockDb.delete.mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([mockDeletedProposal]),
      }),
    } as any);

    const result = await deleteProposal({
      proposalId: 'proposal-id-123',
      user: mockUser,
    });

    expect(result.success).toBe(true);
    expect(result.deletedId).toBe('proposal-id-123');
    expect(mockCheckPermission).toHaveBeenCalledWith(
      { decisions: 'admin' },
      mockOrgUser.roles
    );
  });

  it('should throw UnauthorizedError when user is not authenticated', async () => {
    await expect(
      deleteProposal({
        proposalId: 'proposal-id-123',
        user: null as any,
      })
    ).rejects.toThrow(UnauthorizedError);

    expect(mockDb.query.proposals.findFirst).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedError when user has no active profile', async () => {
    const userWithoutProfile = { ...mockDbUser, currentProfileId: null };
    mockDb.query.users.findFirst.mockResolvedValueOnce(userWithoutProfile);

    await expect(
      deleteProposal({
        proposalId: 'proposal-id-123',
        user: mockUser,
      })
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should throw NotFoundError when proposal does not exist', async () => {
    mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb.query.proposals.findFirst.mockResolvedValueOnce(null);

    await expect(
      deleteProposal({
        proposalId: 'nonexistent-proposal',
        user: mockUser,
      })
    ).rejects.toThrow(NotFoundError);

    expect(mockDb.delete).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedError when user is not submitter, process owner, or admin', async () => {
    const unauthorizedDbUser = {
      ...mockDbUser,
      currentProfileId: 'unauthorized-profile-id',
    };

    // Ensure no admin permissions
    mockCheckPermission.mockReturnValue(false);

    mockDb.query.users.findFirst.mockResolvedValueOnce(unauthorizedDbUser);
    mockDb.query.proposals.findFirst.mockResolvedValueOnce(mockExistingProposal as any);

    await expect(
      deleteProposal({
        proposalId: 'proposal-id-123',
        user: mockUser,
      })
    ).rejects.toThrow(UnauthorizedError);

    expect(mockDb.delete).not.toHaveBeenCalled();
    expect(mockCheckPermission).toHaveBeenCalledWith(
      { decisions: 'admin' },
      mockOrgUser.roles
    );
  });



  it('should prevent deletion of proposals with existing decisions', async () => {
    const proposalWithDecisions = {
      ...mockExistingProposal,
      decisions: [
        {
          id: 'decision-id-1',
          decisionData: { decision: 'approve' },
          decidedByProfileId: 'reviewer-profile-id',
        },
        {
          id: 'decision-id-2',
          decisionData: { decision: 'needs_revision' },
          decidedByProfileId: 'another-reviewer-profile-id',
        },
      ],
    };

    mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb.query.proposals.findFirst.mockResolvedValueOnce(proposalWithDecisions as any);

    await expect(
      deleteProposal({
        proposalId: 'proposal-id-123',
        user: mockUser,
      })
    ).rejects.toThrow(ValidationError);

    expect(mockDb.delete).not.toHaveBeenCalled();
  });


  it('should throw CommonError when database delete fails', async () => {
    mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb.query.proposals.findFirst.mockResolvedValueOnce(mockExistingProposal as any);
    mockDb.delete.mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([]), // Empty array = no result
      }),
    } as any);

    await expect(
      deleteProposal({
        proposalId: 'proposal-id-123',
        user: mockUser,
      })
    ).rejects.toThrow(CommonError);
  });

  it('should handle database errors gracefully', async () => {
    mockDb.query.users.findFirst.mockRejectedValueOnce(
      new Error('Database connection failed')
    );

    await expect(
      deleteProposal({
        proposalId: 'proposal-id-123',
        user: mockUser,
      })
    ).rejects.toThrow(CommonError);
  });

  it('should handle proposals with null decisions array', async () => {
    const proposalWithNullDecisions = {
      ...mockExistingProposal,
      decisions: null,
    };

    const mockDeletedProposal = {
      id: 'proposal-id-123',
    };

    mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb.query.proposals.findFirst.mockResolvedValueOnce(proposalWithNullDecisions as any);
    mockDb.delete.mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([mockDeletedProposal]),
      }),
    } as any);

    const result = await deleteProposal({
      proposalId: 'proposal-id-123',
      user: mockUser,
    });

    expect(result.success).toBe(true);
    // Should handle null decisions array gracefully
  });

  it('should prevent deletion of proposals with existing decisions regardless of status', async () => {
    const proposalWithDecisions = {
      ...mockExistingProposal,
      status: 'draft',
      decisions: [{ id: 'decision-1', decisionData: {} }],
    };

    mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb.query.proposals.findFirst.mockResolvedValueOnce(proposalWithDecisions as any);

    await expect(
      deleteProposal({
        proposalId: 'proposal-id-123',
        user: mockUser,
      })
    ).rejects.toThrow(ValidationError);

    expect(mockDb.delete).not.toHaveBeenCalled();
  });

  it('should include correct error messages', async () => {
    // Test unauthorized user error message
    const unauthorizedDbUser = {
      ...mockDbUser,
      currentProfileId: 'unauthorized-profile-id',
    };

    mockDb.query.users.findFirst.mockResolvedValueOnce(unauthorizedDbUser);
    mockDb.query.proposals.findFirst.mockResolvedValueOnce(mockExistingProposal as any);

    try {
      await deleteProposal({
        proposalId: 'proposal-id-123',
        user: mockUser,
      });
    } catch (error) {
      expect(error.message).toContain('Not authorized to delete this proposal');
    }

    // Test existing decisions error message
    const proposalWithDecisions = {
      ...mockExistingProposal,
      decisions: [{ id: 'decision-1' }],
    };

    mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb.query.proposals.findFirst.mockResolvedValueOnce(proposalWithDecisions as any);

    try {
      await deleteProposal({
        proposalId: 'proposal-id-123',
        user: mockUser,
      });
    } catch (error) {
      expect(error.message).toContain('Cannot delete proposal with existing decisions');
    }
  });
});