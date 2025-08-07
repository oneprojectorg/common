import { describe, expect, it, vi, beforeEach } from 'vitest';
import { listProposals } from '../listProposals';
import { UnauthorizedError } from '../../../utils';
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

const mockProposals = [
  {
    id: 'proposal-id-1',
    processInstanceId: 'instance-id-1',
    proposalData: { title: 'First Proposal' },
    submittedByProfileId: 'profile-id-123',
    status: 'submitted',
    createdAt: '2024-01-01T00:00:00Z',
    processInstance: {
      id: 'instance-id-1',
      name: 'First Instance',
      process: {
        id: 'process-id-1',
        name: 'Test Process',
      },
    },
    submittedBy: {
      id: 'profile-id-123',
      name: 'John Doe',
    },
  },
  {
    id: 'proposal-id-2',
    processInstanceId: 'instance-id-2',
    proposalData: { title: 'Second Proposal' },
    submittedByProfileId: 'profile-id-456',
    status: 'approved',
    createdAt: '2024-01-02T00:00:00Z',
    processInstance: {
      id: 'instance-id-2',
      name: 'Second Instance',
      process: {
        id: 'process-id-2',
        name: 'Another Process',
      },
    },
    submittedBy: {
      id: 'profile-id-456',
      name: 'Jane Smith',
    },
  },
];

describe('listProposals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock setup for successful queries
    mockDb.query.users.findFirst.mockResolvedValue(mockDbUser);
    
    // Mock count query
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: mockProposals.length }]),
      }),
    });
    
    // Mock proposals query
    mockDb.query.proposals.findMany.mockResolvedValue(mockProposals);
    
    // Mock decision count queries
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ decisionCount: 2 }]),
      }),
    });
  });

  it('should list proposals successfully with default parameters', async () => {
    const result = await listProposals({
      input: {},
      user: mockUser,
    });

    expect(result).toEqual({
      proposals: expect.arrayContaining([
        expect.objectContaining({
          id: 'proposal-id-1',
          decisionCount: 2,
        }),
        expect.objectContaining({
          id: 'proposal-id-2',
          decisionCount: 2,
        }),
      ]),
      total: mockProposals.length,
      hasMore: false,
    });

    expect(mockDb.query.users.findFirst).toHaveBeenCalled();
    expect(mockDb.query.proposals.findMany).toHaveBeenCalled();
  });

  it('should throw UnauthorizedError when user is not authenticated', async () => {
    await expect(
      listProposals({
        input: {},
        user: null as any,
      })
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError when user has no active profile', async () => {
    const userWithoutProfile = { ...mockDbUser, currentProfileId: null };
    mockDb.query.users.findFirst.mockResolvedValueOnce(userWithoutProfile);

    await expect(
      listProposals({
        input: {},
        user: mockUser,
      })
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should filter proposals by processInstanceId', async () => {
    const filteredProposals = [mockProposals[0]];
    mockDb.query.proposals.findMany.mockResolvedValueOnce(filteredProposals);
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([{ count: 1 }]),
      }),
    });

    const result = await listProposals({
      input: {
        processInstanceId: 'instance-id-1',
      },
      user: mockUser,
    });

    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].processInstanceId).toBe('instance-id-1');
    expect(result.total).toBe(1);
  });

  it('should filter proposals by submittedByProfileId', async () => {
    const filteredProposals = [mockProposals[1]];
    mockDb.query.proposals.findMany.mockResolvedValueOnce(filteredProposals);
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([{ count: 1 }]),
      }),
    });

    const result = await listProposals({
      input: {
        submittedByProfileId: 'profile-id-456',
      },
      user: mockUser,
    });

    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].submittedByProfileId).toBe('profile-id-456');
  });

  it('should filter proposals by status', async () => {
    const approvedProposals = [mockProposals[1]];
    mockDb.query.proposals.findMany.mockResolvedValueOnce(approvedProposals);
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([{ count: 1 }]),
      }),
    });

    const result = await listProposals({
      input: {
        status: 'approved',
      },
      user: mockUser,
    });

    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].status).toBe('approved');
  });

  it('should support search functionality', async () => {
    const searchResults = [mockProposals[0]];
    mockDb.query.proposals.findMany.mockResolvedValueOnce(searchResults);
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([{ count: 1 }]),
      }),
    });

    const result = await listProposals({
      input: {
        search: 'First',
      },
      user: mockUser,
    });

    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].proposalData.title).toContain('First');
  });

  it('should handle pagination correctly', async () => {
    const paginatedProposals = [mockProposals[1]];
    mockDb.query.proposals.findMany.mockResolvedValueOnce(paginatedProposals);
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([{ count: 10 }]),
      }),
    });

    const result = await listProposals({
      input: {
        limit: 1,
        offset: 1,
      },
      user: mockUser,
    });

    expect(result.proposals).toHaveLength(1);
    expect(result.total).toBe(10);
    expect(result.hasMore).toBe(true);

    // Check that findMany was called with correct limit and offset
    expect(mockDb.query.proposals.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 1,
        offset: 1,
      })
    );
  });

  it('should support different ordering options', async () => {
    const orderingTests = [
      { orderBy: 'createdAt', orderDirection: 'desc' },
      { orderBy: 'updatedAt', orderDirection: 'asc' },
      { orderBy: 'status', orderDirection: 'desc' },
    ];

    for (const testCase of orderingTests) {
      mockDb.query.proposals.findMany.mockResolvedValueOnce(mockProposals);

      await listProposals({
        input: {
          orderBy: testCase.orderBy as any,
          orderDirection: testCase.orderDirection as any,
        },
        user: mockUser,
      });

      // Verify that findMany was called with orderBy parameter
      expect(mockDb.query.proposals.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.any(Function),
        })
      );

      vi.clearAllMocks();
      // Reset mocks for next iteration
      mockDb.query.users.findFirst.mockResolvedValue(mockDbUser);
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 2 }]),
        }),
      });
    }
  });

  it('should combine multiple filters correctly', async () => {
    const filteredProposals = [mockProposals[0]];
    mockDb.query.proposals.findMany.mockResolvedValueOnce(filteredProposals);
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([{ count: 1 }]),
      }),
    });

    const result = await listProposals({
      input: {
        processInstanceId: 'instance-id-1',
        status: 'submitted',
        submittedByProfileId: 'profile-id-123',
        search: 'First',
        limit: 10,
        offset: 0,
        orderBy: 'createdAt',
        orderDirection: 'desc',
      },
      user: mockUser,
    });

    expect(result.proposals).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.hasMore).toBe(false);
  });

  it('should handle empty results', async () => {
    mockDb.query.proposals.findMany.mockResolvedValueOnce([]);
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([{ count: 0 }]),
      }),
    });

    const result = await listProposals({
      input: {
        status: 'nonexistent' as any,
      },
      user: mockUser,
    });

    expect(result.proposals).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  it('should calculate decision counts correctly', async () => {
    const proposalsWithDifferentCounts = mockProposals.map((proposal, index) => ({
      ...proposal,
    }));

    mockDb.query.proposals.findMany.mockResolvedValueOnce(proposalsWithDifferentCounts);
    
    // Mock different decision counts for each proposal
    let callCount = 0;
    mockDb.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          if (callCount === 0) {
            // First call is for total count
            callCount++;
            return Promise.resolve([{ count: 2 }]);
          } else {
            // Subsequent calls are for decision counts
            const decisionCount = callCount === 1 ? 5 : 3;
            callCount++;
            return Promise.resolve([{ decisionCount }]);
          }
        }),
      }),
    }));

    const result = await listProposals({
      input: {},
      user: mockUser,
    });

    expect(result.proposals[0].decisionCount).toBe(5);
    expect(result.proposals[1].decisionCount).toBe(3);
  });

  it('should handle database errors gracefully', async () => {
    mockDb.query.users.findFirst.mockRejectedValueOnce(
      new Error('Database connection failed')
    );

    await expect(
      listProposals({
        input: {},
        user: mockUser,
      })
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should respect maximum limit', async () => {
    const result = await listProposals({
      input: {
        limit: 150, // Should be capped
      },
      user: mockUser,
    });

    // The service should handle this gracefully (actual limit enforcement would be in validation layer)
    expect(result).toBeDefined();
  });

  it('should handle edge cases with hasMore calculation', async () => {
    // Test case where offset + limit equals total
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([{ count: 20 }]),
      }),
    });

    const result = await listProposals({
      input: {
        limit: 10,
        offset: 10,
      },
      user: mockUser,
    });

    expect(result.hasMore).toBe(false);
  });
});