import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockDb } from '../../../test/setup';
import { NotFoundError, UnauthorizedError } from '../../../utils';
import { getProposal } from '../getProposal';

const mockUser = {
  id: 'auth-user-id',
  email: 'test@example.com',
} as any;

const mockFullProposal = {
  id: 'proposal-id-123',
  processInstanceId: 'instance-id-123',
  proposalData: {
    title: 'Test Proposal',
    description: 'A comprehensive test proposal',
    category: 'improvement',
  },
  submittedByProfileId: 'profile-id-123',
  status: 'submitted',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  processInstance: {
    id: 'instance-id-123',
    name: 'Test Instance',
    status: 'active',
    process: {
      id: 'process-id-123',
      name: 'Test Process',
      description: 'A test decision process',
    },
    owner: {
      id: 'owner-profile-id',
      name: 'Process Owner',
      email: 'owner@example.com',
    },
  },
  submittedBy: {
    id: 'profile-id-123',
    name: 'John Doe',
    email: 'john@example.com',
  },
  decisions: [
    {
      id: 'decision-id-1',
      decisionData: { decision: 'approve', comment: 'Good proposal' },
      decidedBy: {
        id: 'reviewer-profile-id',
        name: 'Jane Reviewer',
        email: 'jane@example.com',
      },
      createdAt: '2024-01-01T10:00:00Z',
    },
    {
      id: 'decision-id-2',
      decisionData: { decision: 'approve', comment: 'I agree' },
      decidedBy: {
        id: 'another-reviewer-profile-id',
        name: 'Bob Reviewer',
        email: 'bob@example.com',
      },
      createdAt: '2024-01-01T11:00:00Z',
    },
  ],
};

describe('getProposal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch proposal successfully with all relations', async () => {
    mockDb._query.proposals.findFirst.mockResolvedValueOnce(
      mockFullProposal as any,
    );

    const result = await getProposal({
      proposalId: 'proposal-id-123',
      user: mockUser,
    });

    expect(result).toEqual(mockFullProposal);
    expect(mockDb._query.proposals.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        with: {
          processInstance: {
            with: {
              process: true,
              owner: true,
            },
          },
          submittedBy: true,
          decisions: {
            with: {
              decidedBy: true,
            },
          },
        },
      }),
    );
  });

  it('should throw UnauthorizedError when user is not authenticated', async () => {
    await expect(
      getProposal({
        proposalId: 'proposal-id-123',
        user: null as any,
      }),
    ).rejects.toThrow(UnauthorizedError);

    expect(mockDb._query.proposals.findFirst).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError when proposal does not exist', async () => {
    mockDb._query.proposals.findFirst.mockResolvedValueOnce(null);

    await expect(
      getProposal({
        proposalId: 'nonexistent-proposal',
        user: mockUser,
      }),
    ).rejects.toThrow(NotFoundError);

    expect(mockDb._query.proposals.findFirst).toHaveBeenCalled();
  });

  it('should handle proposals with no decisions', async () => {
    const proposalWithoutDecisions = {
      ...mockFullProposal,
      decisions: [],
    };

    mockDb._query.proposals.findFirst.mockResolvedValueOnce(
      proposalWithoutDecisions as any,
    );

    const result = await getProposal({
      proposalId: 'proposal-id-123',
      user: mockUser,
    });

    expect(result).toEqual(proposalWithoutDecisions);
    expect(result.decisions).toEqual([]);
  });

  it('should handle proposals with minimal related data', async () => {
    const minimalProposal = {
      id: 'proposal-id-123',
      processInstanceId: 'instance-id-123',
      proposalData: { title: 'Minimal Proposal' },
      submittedByProfileId: 'profile-id-123',
      status: 'draft',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      processInstance: {
        id: 'instance-id-123',
        name: 'Minimal Instance',
        process: {
          id: 'process-id-123',
          name: 'Minimal Process',
        },
        owner: {
          id: 'owner-profile-id',
          name: 'Owner',
        },
      },
      submittedBy: {
        id: 'profile-id-123',
        name: 'Submitter',
      },
      decisions: [],
    };

    mockDb._query.proposals.findFirst.mockResolvedValueOnce(
      minimalProposal as any,
    );

    const result = await getProposal({
      proposalId: 'proposal-id-123',
      user: mockUser,
    });

    expect(result).toEqual(minimalProposal);
  });

  it('should handle database errors gracefully', async () => {
    mockDb._query.proposals.findFirst.mockRejectedValueOnce(
      new Error('Database connection failed'),
    );

    await expect(
      getProposal({
        proposalId: 'proposal-id-123',
        user: mockUser,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('should work with different proposal statuses', async () => {
    const statuses = [
      'draft',
      'submitted',
      'under_review',
      'approved',
      'rejected',
    ];

    for (const status of statuses) {
      const proposalWithStatus = {
        ...mockFullProposal,
        status,
      };

      mockDb._query.proposals.findFirst.mockResolvedValueOnce(
        proposalWithStatus as any,
      );

      const result = await getProposal({
        proposalId: `proposal-${status}`,
        user: mockUser,
      });

      expect(result.status).toBe(status);
      vi.clearAllMocks();
    }
  });

  it('should include complex proposal data structures', async () => {
    const proposalWithComplexData = {
      ...mockFullProposal,
      proposalData: {
        title: 'Complex Proposal',
        description: 'A proposal with complex nested data',
        metadata: {
          priority: 'high',
          tags: ['important', 'urgent'],
          attachments: [
            { name: 'document.pdf', size: 1024, type: 'application/pdf' },
            { name: 'image.jpg', size: 2048, type: 'image/jpeg' },
          ],
        },
        budget: {
          requested: 50000,
          currency: 'USD',
          breakdown: {
            development: 30000,
            testing: 10000,
            deployment: 5000,
            contingency: 5000,
          },
        },
      },
    };

    mockDb._query.proposals.findFirst.mockResolvedValueOnce(
      proposalWithComplexData as any,
    );

    const result = await getProposal({
      proposalId: 'proposal-id-123',
      user: mockUser,
    });

    expect(result.proposalData).toEqual(proposalWithComplexData.proposalData);
    expect(result.proposalData.metadata.tags).toContain('important');
    expect(result.proposalData.budget.breakdown.development).toBe(30000);
  });

  it('should handle proposals with multiple decisions from same user', async () => {
    const proposalWithMultipleDecisions = {
      ...mockFullProposal,
      decisions: [
        {
          id: 'decision-id-1',
          decisionData: {
            decision: 'needs_revision',
            comment: 'Please revise section 2',
          },
          decidedBy: {
            id: 'reviewer-profile-id',
            name: 'Jane Reviewer',
          },
          createdAt: '2024-01-01T10:00:00Z',
        },
        {
          id: 'decision-id-2',
          decisionData: {
            decision: 'approve',
            comment: 'Looks good after revision',
          },
          decidedBy: {
            id: 'reviewer-profile-id',
            name: 'Jane Reviewer',
          },
          createdAt: '2024-01-01T12:00:00Z',
        },
      ],
    };

    mockDb._query.proposals.findFirst.mockResolvedValueOnce(
      proposalWithMultipleDecisions as any,
    );

    const result = await getProposal({
      proposalId: 'proposal-id-123',
      user: mockUser,
    });

    expect(result.decisions).toHaveLength(2);
    expect(result.decisions[0].decisionData.decision).toBe('needs_revision');
    expect(result.decisions[1].decisionData.decision).toBe('approve');
  });
});
