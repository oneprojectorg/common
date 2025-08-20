import { describe, expect, it, vi, beforeEach } from 'vitest';
import { updateProposal } from '../updateProposal';
import { UnauthorizedError, NotFoundError, ValidationError, CommonError } from '../../../utils';
import type { ProposalData } from '../types';
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
  proposalData: { title: 'Original Title' },
  submittedByProfileId: 'profile-id-123',
  status: 'submitted',
  processInstance: {
    id: 'instance-id-123',
    ownerProfileId: mockProcessOwnerProfile,
  },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('updateProposal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update proposal successfully by submitter', async () => {
    const updatedData = {
      proposalData: { title: 'Updated Title' } as ProposalData,
    };

    const mockUpdatedProposal = {
      ...mockExistingProposal,
      proposalData: updatedData.proposalData,
      updatedAt: '2024-01-01T12:00:00Z',
    };

    mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb.query.proposals.findFirst.mockResolvedValueOnce(mockExistingProposal as any);
    mockDb.update.mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([mockUpdatedProposal]),
        }),
      }),
    } as any);

    const result = await updateProposal({
      proposalId: 'proposal-id-123',
      data: updatedData,
      user: mockUser,
    });

    expect(result).toEqual(mockUpdatedProposal);
    expect(mockDb.query.users.findFirst).toHaveBeenCalled();
    expect(mockDb.query.proposals.findFirst).toHaveBeenCalled();
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('should update proposal successfully by process owner', async () => {
    const processOwnerDbUser = {
      ...mockDbUser,
      currentProfileId: mockProcessOwnerProfile,
    };

    // Use a proposal in under_review status since that can transition to approved
    const proposalUnderReview = {
      ...mockExistingProposal,
      status: 'under_review',
    };

    const updatedData = {
      status: 'approved' as const,
    };

    const mockUpdatedProposal = {
      ...proposalUnderReview,
      status: 'approved',
      updatedAt: '2024-01-01T12:00:00Z',
    };

    mockDb.query.users.findFirst.mockResolvedValueOnce(processOwnerDbUser);
    mockDb.query.proposals.findFirst.mockResolvedValueOnce(proposalUnderReview as any);
    mockDb.update.mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([mockUpdatedProposal]),
        }),
      }),
    } as any);

    const result = await updateProposal({
      proposalId: 'proposal-id-123',
      data: updatedData,
      user: mockUser,
    });

    expect(result).toEqual(mockUpdatedProposal);
  });

  it('should throw UnauthorizedError when user is not authenticated', async () => {
    await expect(
      updateProposal({
        proposalId: 'proposal-id-123',
        data: { proposalData: { title: 'Updated' } },
        user: null as any,
      })
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError when user has no active profile', async () => {
    const userWithoutProfile = { ...mockDbUser, currentProfileId: null };
    mockDb.query.users.findFirst.mockResolvedValueOnce(userWithoutProfile);

    await expect(
      updateProposal({
        proposalId: 'proposal-id-123',
        data: { proposalData: { title: 'Updated' } },
        user: mockUser,
      })
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should throw NotFoundError when proposal not found', async () => {
    mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb.query.proposals.findFirst.mockResolvedValueOnce(null);

    await expect(
      updateProposal({
        proposalId: 'nonexistent-proposal',
        data: { proposalData: { title: 'Updated' } },
        user: mockUser,
      })
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw UnauthorizedError when user is not submitter or process owner', async () => {
    const unauthorizedDbUser = {
      ...mockDbUser,
      currentProfileId: 'unauthorized-profile-id',
    };

    mockDb.query.users.findFirst.mockResolvedValueOnce(unauthorizedDbUser);
    mockDb.query.proposals.findFirst.mockResolvedValueOnce(mockExistingProposal as any);

    await expect(
      updateProposal({
        proposalId: 'proposal-id-123',
        data: { proposalData: { title: 'Updated' } },
        user: mockUser,
      })
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should validate status transitions correctly', async () => {
    const testCases = [
      { from: 'draft', to: 'submitted', shouldPass: true, needsProcessOwner: false },
      { from: 'submitted', to: 'under_review', shouldPass: true, needsProcessOwner: false },
      { from: 'submitted', to: 'draft', shouldPass: true, needsProcessOwner: false },
      { from: 'under_review', to: 'approved', shouldPass: true, needsProcessOwner: true },
      { from: 'under_review', to: 'rejected', shouldPass: true, needsProcessOwner: true },
      { from: 'approved', to: 'submitted', shouldPass: false, needsProcessOwner: false },
      { from: 'rejected', to: 'submitted', shouldPass: false, needsProcessOwner: false },
      { from: 'submitted', to: 'approved', shouldPass: false, needsProcessOwner: true }, // Must go through under_review first
    ];

    for (const testCase of testCases) {
      const userToUse = testCase.needsProcessOwner ? {
        ...mockDbUser,
        currentProfileId: mockProcessOwnerProfile,
      } : mockDbUser;

      mockDb.query.users.findFirst.mockResolvedValueOnce(userToUse);
      mockDb.query.proposals.findFirst.mockResolvedValueOnce({
        ...mockExistingProposal,
        status: testCase.from,
      } as any);

      if (testCase.shouldPass) {
        mockDb.update.mockReturnValueOnce({
          set: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              returning: vi.fn().mockResolvedValueOnce([{
                ...mockExistingProposal,
                status: testCase.to,
              }]),
            }),
          }),
        } as any);

        const result = await updateProposal({
          proposalId: 'proposal-id-123',
          data: { status: testCase.to as any },
          user: mockUser,
        });

        expect(result.status).toBe(testCase.to);
      } else {
        await expect(
          updateProposal({
            proposalId: 'proposal-id-123',
            data: { status: testCase.to as any },
            user: mockUser,
          })
        ).rejects.toThrow();
      }

      vi.clearAllMocks();
    }
  });

  it('should only allow process owner to approve/reject proposals', async () => {
    // Test with submitter (not process owner) trying to approve
    mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb.query.proposals.findFirst.mockResolvedValueOnce({
      ...mockExistingProposal,
      status: 'under_review',
    } as any);

    await expect(
      updateProposal({
        proposalId: 'proposal-id-123',
        data: { status: 'approved' },
        user: mockUser,
      })
    ).rejects.toThrow(UnauthorizedError);

    // Test with process owner approving
    const processOwnerDbUser = {
      ...mockDbUser,
      currentProfileId: mockProcessOwnerProfile,
    };

    mockDb.query.users.findFirst.mockResolvedValueOnce(processOwnerDbUser);
    mockDb.query.proposals.findFirst.mockResolvedValueOnce({
      ...mockExistingProposal,
      status: 'under_review',
    } as any);
    mockDb.update.mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([{
            ...mockExistingProposal,
            status: 'approved',
          }]),
        }),
      }),
    } as any);

    const result = await updateProposal({
      proposalId: 'proposal-id-123',
      data: { status: 'approved' },
      user: mockUser,
    });

    expect(result.status).toBe('approved');
  });

  it('should handle simultaneous updates to data and status', async () => {
    const updatedData = {
      proposalData: { title: 'New Title', description: 'New Description' } as ProposalData,
      status: 'under_review' as const,
    };

    const mockUpdatedProposal = {
      ...mockExistingProposal,
      proposalData: updatedData.proposalData,
      status: updatedData.status,
      updatedAt: '2024-01-01T12:00:00Z',
    };

    mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb.query.proposals.findFirst.mockResolvedValueOnce(mockExistingProposal as any);
    mockDb.update.mockReturnValueOnce({
      set: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([mockUpdatedProposal]),
        }),
      }),
    } as any);

    const result = await updateProposal({
      proposalId: 'proposal-id-123',
      data: updatedData,
      user: mockUser,
    });

    expect(result).toEqual(mockUpdatedProposal);
  });

  it('should throw CommonError when database update fails', async () => {
    mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb.query.proposals.findFirst.mockResolvedValueOnce(mockExistingProposal as any);
    
    const mockSetFunction = vi.fn().mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([]), // Empty array = no result
      }),
    });
    
    mockDb.update.mockReturnValueOnce({
      set: mockSetFunction,
    } as any);

    await expect(
      updateProposal({
        proposalId: 'proposal-id-123',
        data: { proposalData: { title: 'Updated' } },
        user: mockUser,
      })
    ).rejects.toThrow(CommonError);
  });

  it('should handle database errors gracefully', async () => {
    mockDb.query.users.findFirst.mockRejectedValueOnce(
      new Error('Database connection failed')
    );

    await expect(
      updateProposal({
        proposalId: 'proposal-id-123',
        data: { proposalData: { title: 'Updated' } },
        user: mockUser,
      })
    ).rejects.toThrow(CommonError);
  });

  it('should include updatedAt timestamp in update', async () => {
    const beforeUpdate = Date.now();

    mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb.query.proposals.findFirst.mockResolvedValueOnce(mockExistingProposal as any);

    const mockUpdatedProposal = {
      ...mockExistingProposal,
      proposalData: { title: 'Updated' },
      updatedAt: new Date().toISOString(),
    };

    const mockSetFunction = vi.fn().mockReturnValueOnce({
      where: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([mockUpdatedProposal]),
      }),
    });

    mockDb.update.mockReturnValueOnce({
      set: mockSetFunction,
    } as any);

    await updateProposal({
      proposalId: 'proposal-id-123',
      data: { proposalData: { title: 'Updated' } },
      user: mockUser,
    });

    const setCallArgs = mockSetFunction.mock.calls[0][0];
    expect(setCallArgs).toHaveProperty('updatedAt');
    expect(new Date(setCallArgs.updatedAt).getTime()).toBeGreaterThanOrEqual(beforeUpdate);
  });
});