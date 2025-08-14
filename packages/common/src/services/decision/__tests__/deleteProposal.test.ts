import { describe, expect, it, vi, beforeEach } from 'vitest';
import { deleteProposal } from '../deleteProposal';
import { UnauthorizedError, NotFoundError, ValidationError, CommonError } from '../../../utils';
import { mockDb } from '../../../test/setup';

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

describe('deleteProposal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('should throw UnauthorizedError when user is not submitter or process owner', async () => {
    const unauthorizedDbUser = {
      ...mockDbUser,
      currentProfileId: 'unauthorized-profile-id',
    };

    mockDb.query.users.findFirst.mockResolvedValueOnce(unauthorizedDbUser);
    mockDb.query.proposals.findFirst.mockResolvedValueOnce(mockExistingProposal as any);

    await expect(
      deleteProposal({
        proposalId: 'proposal-id-123',
        user: mockUser,
      })
    ).rejects.toThrow(UnauthorizedError);

    expect(mockDb.delete).not.toHaveBeenCalled();
  });

  it('should validate proposal status before deletion', async () => {
    const invalidStatuses = ['submitted', 'under_review', 'approved'];

    for (const status of invalidStatuses) {
      const proposalWithInvalidStatus = {
        ...mockExistingProposal,
        status,
      };

      mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
      mockDb.query.proposals.findFirst.mockResolvedValueOnce(proposalWithInvalidStatus as any);

      await expect(
        deleteProposal({
          proposalId: 'proposal-id-123',
          user: mockUser,
        })
      ).rejects.toThrow(ValidationError);

      expect(mockDb.delete).not.toHaveBeenCalled();
      vi.clearAllMocks();
    }
  });

  it('should allow deletion of rejected proposals', async () => {
    const rejectedProposal = {
      ...mockExistingProposal,
      status: 'rejected',
    };

    const mockDeletedProposal = {
      id: 'proposal-id-123',
    };

    mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb.query.proposals.findFirst.mockResolvedValueOnce(rejectedProposal as any);
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
    expect(mockDb.delete).toHaveBeenCalled();
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

  it('should handle default status as draft', async () => {
    const proposalWithNoStatus = {
      ...mockExistingProposal,
      status: null, // or undefined
    };

    const mockDeletedProposal = {
      id: 'proposal-id-123',
    };

    mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb.query.proposals.findFirst.mockResolvedValueOnce(proposalWithNoStatus as any);
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
    // Should treat null/undefined status as 'draft' and allow deletion
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

  it('should validate both status and decisions conditions', async () => {
    // Test proposal in valid status but with decisions
    const proposalDraftWithDecisions = {
      ...mockExistingProposal,
      status: 'draft',
      decisions: [{ id: 'decision-1', decisionData: {} }],
    };

    mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb.query.proposals.findFirst.mockResolvedValueOnce(proposalDraftWithDecisions as any);

    await expect(
      deleteProposal({
        proposalId: 'proposal-id-123',
        user: mockUser,
      })
    ).rejects.toThrow(ValidationError);

    // Test proposal in invalid status but without decisions
    const proposalSubmittedNoDecisions = {
      ...mockExistingProposal,
      status: 'submitted',
      decisions: [],
    };

    mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb.query.proposals.findFirst.mockResolvedValueOnce(proposalSubmittedNoDecisions as any);

    await expect(
      deleteProposal({
        proposalId: 'proposal-id-123',
        user: mockUser,
      })
    ).rejects.toThrow(ValidationError);
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

    // Test invalid status error message
    const submittedProposal = {
      ...mockExistingProposal,
      status: 'submitted',
    };

    mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb.query.proposals.findFirst.mockResolvedValueOnce(submittedProposal as any);

    try {
      await deleteProposal({
        proposalId: 'proposal-id-123',
        user: mockUser,
      });
    } catch (error) {
      expect(error.message).toContain('Cannot delete proposal in submitted status');
    }
  });
});