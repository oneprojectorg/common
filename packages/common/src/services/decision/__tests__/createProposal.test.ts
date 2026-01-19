import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockDb } from '../../../test/setup';
import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../utils';
import { createProposal } from '../createProposal';
import type { InstanceData, ProcessSchema, ProposalData } from '../types';

const mockUser = {
  id: 'auth-user-id',
  email: 'test@example.com',
} as any;

const mockDbUser = {
  id: 'db-user-id',
  currentProfileId: 'profile-id-123',
  authUserId: 'auth-user-id',
};

const mockProcessSchema: ProcessSchema = {
  name: 'Test Process',
  states: [
    {
      id: 'draft',
      name: 'Draft',
      type: 'initial',
      config: {
        allowProposals: true,
      },
    },
    {
      id: 'review',
      name: 'Review',
      type: 'intermediate',
      config: {
        allowProposals: false,
      },
    },
  ],
  transitions: [],
  initialState: 'draft',
  decisionDefinition: { type: 'object' },
  proposalTemplate: { type: 'object' },
};

const mockInstanceData: InstanceData = {
  currentStateId: 'draft',
  stateData: {},
  fieldValues: {},
};

const mockInstance = {
  id: 'instance-id-123',
  processId: 'process-id-123',
  currentStateId: 'draft',
  instanceData: mockInstanceData,
  process: {
    id: 'process-id-123',
    processSchema: mockProcessSchema,
  },
};

const mockProposalData: ProposalData = {
  title: 'Test Proposal',
  description: 'A test proposal for decision making',
  category: 'improvement',
};

describe('createProposal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a proposal successfully', async () => {
    const mockCreatedProposal = {
      id: 'proposal-id-123',
      processInstanceId: 'instance-id-123',
      proposalData: mockProposalData,
      submittedByProfileId: 'profile-id-123',
      status: 'submitted',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    mockDb._query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb._query.processInstances.findFirst.mockResolvedValueOnce(
      mockInstance as any,
    );
    mockDb.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([mockCreatedProposal]),
      }),
    } as any);

    const result = await createProposal({
      data: {
        processInstanceId: 'instance-id-123',
        proposalData: mockProposalData,
        authUserId: 'auth-user-id',
      },
      user: mockUser,
    });

    expect(result).toEqual(mockCreatedProposal);
    expect(mockDb._query.users.findFirst).toHaveBeenCalled();
    expect(mockDb._query.processInstances.findFirst).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('should throw UnauthorizedError when user is not authenticated', async () => {
    await expect(
      createProposal({
        data: {
          processInstanceId: 'instance-id-123',
          proposalData: mockProposalData,
          authUserId: 'auth-user-id',
        },
        user: null as any,
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError when user has no active profile', async () => {
    const userWithoutProfile = { ...mockDbUser, currentProfileId: null };
    mockDb._query.users.findFirst.mockResolvedValueOnce(userWithoutProfile);

    await expect(
      createProposal({
        data: {
          processInstanceId: 'instance-id-123',
          proposalData: mockProposalData,
          authUserId: 'auth-user-id',
        },
        user: mockUser,
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should throw NotFoundError when process instance not found', async () => {
    mockDb._query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb._query.processInstances.findFirst.mockResolvedValueOnce(null);

    await expect(
      createProposal({
        data: {
          processInstanceId: 'nonexistent-instance',
          proposalData: mockProposalData,
          authUserId: 'auth-user-id',
        },
        user: mockUser,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw NotFoundError when process definition not found', async () => {
    const instanceWithoutProcess = { ...mockInstance, process: null };

    mockDb._query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb._query.processInstances.findFirst.mockResolvedValueOnce(
      instanceWithoutProcess as any,
    );

    await expect(
      createProposal({
        data: {
          processInstanceId: 'instance-id-123',
          proposalData: mockProposalData,
          authUserId: 'auth-user-id',
        },
        user: mockUser,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw ValidationError when current state does not exist', async () => {
    const instanceWithInvalidState = {
      ...mockInstance,
      instanceData: { ...mockInstanceData, currentStateId: 'invalid-state' },
    };

    mockDb._query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb._query.processInstances.findFirst.mockResolvedValueOnce(
      instanceWithInvalidState as any,
    );

    await expect(
      createProposal({
        data: {
          processInstanceId: 'instance-id-123',
          proposalData: mockProposalData,
          authUserId: 'auth-user-id',
        },
        user: mockUser,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('should throw ValidationError when proposals are not allowed in current state', async () => {
    const instanceInReviewState = {
      ...mockInstance,
      currentStateId: 'review',
      instanceData: { ...mockInstanceData, currentStateId: 'review' },
    };

    mockDb._query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb._query.processInstances.findFirst.mockResolvedValueOnce(
      instanceInReviewState as any,
    );

    await expect(
      createProposal({
        data: {
          processInstanceId: 'instance-id-123',
          proposalData: mockProposalData,
          authUserId: 'auth-user-id',
        },
        user: mockUser,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('should allow proposals when allowProposals is not explicitly set to false', async () => {
    const processSchemaWithoutConfig = {
      ...mockProcessSchema,
      states: [
        {
          id: 'open',
          name: 'Open',
          type: 'initial' as const,
          // No config defined - should default to allowing proposals
        },
      ],
    };

    const instanceWithoutConfig = {
      ...mockInstance,
      currentStateId: 'open',
      instanceData: { ...mockInstanceData, currentStateId: 'open' },
      process: {
        ...mockInstance.process,
        processSchema: processSchemaWithoutConfig,
      },
    };

    const mockCreatedProposal = {
      id: 'proposal-id-123',
      processInstanceId: 'instance-id-123',
      proposalData: mockProposalData,
      submittedByProfileId: 'profile-id-123',
      status: 'submitted',
    };

    mockDb._query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb._query.processInstances.findFirst.mockResolvedValueOnce(
      instanceWithoutConfig as any,
    );
    mockDb.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([mockCreatedProposal]),
      }),
    } as any);

    const result = await createProposal({
      data: {
        processInstanceId: 'instance-id-123',
        proposalData: mockProposalData,
        authUserId: 'auth-user-id',
      },
      user: mockUser,
    });

    expect(result).toEqual(mockCreatedProposal);
  });

  it('should throw CommonError when database insert fails', async () => {
    mockDb._query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb._query.processInstances.findFirst.mockResolvedValueOnce(
      mockInstance as any,
    );
    mockDb.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([]), // Empty array = no result
      }),
    } as any);

    await expect(
      createProposal({
        data: {
          processInstanceId: 'instance-id-123',
          proposalData: mockProposalData,
          authUserId: 'auth-user-id',
        },
        user: mockUser,
      }),
    ).rejects.toThrow(CommonError);
  });

  it('should handle database errors gracefully', async () => {
    mockDb._query.users.findFirst.mockRejectedValueOnce(
      new Error('Database connection failed'),
    );

    await expect(
      createProposal({
        data: {
          processInstanceId: 'instance-id-123',
          proposalData: mockProposalData,
          authUserId: 'auth-user-id',
        },
        user: mockUser,
      }),
    ).rejects.toThrow(CommonError);
  });

  it('should use correct fallback for currentStateId', async () => {
    const instanceWithFallbackState = {
      ...mockInstance,
      currentStateId: 'fallback-state',
      instanceData: { ...mockInstanceData, currentStateId: undefined },
    };

    const processSchemaWithFallbackState = {
      ...mockProcessSchema,
      states: [
        ...mockProcessSchema.states,
        {
          id: 'fallback-state',
          name: 'Fallback State',
          type: 'intermediate' as const,
          config: {
            allowProposals: true,
          },
        },
      ],
    };

    const mockCreatedProposal = {
      id: 'proposal-id-123',
      processInstanceId: 'instance-id-123',
      proposalData: mockProposalData,
      status: 'submitted',
    };

    mockDb._query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb._query.processInstances.findFirst.mockResolvedValueOnce({
      ...instanceWithFallbackState,
      process: {
        ...instanceWithFallbackState.process,
        processSchema: processSchemaWithFallbackState,
      },
    } as any);
    mockDb.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([mockCreatedProposal]),
      }),
    } as any);

    const result = await createProposal({
      data: {
        processInstanceId: 'instance-id-123',
        proposalData: mockProposalData,
        authUserId: 'auth-user-id',
      },
      user: mockUser,
    });

    expect(result).toEqual(mockCreatedProposal);
  });
});
