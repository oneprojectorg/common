import { db, eq } from '@op/db/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CommonError, NotFoundError, UnauthorizedError } from '../../../utils';
import { createInstance } from '../createInstance';
import type { InstanceData, ProcessSchema } from '../types';

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
    },
    {
      id: 'review',
      name: 'Review',
      type: 'intermediate',
    },
  ],
  transitions: [],
  initialState: 'draft',
  decisionDefinition: { type: 'object' },
  proposalTemplate: { type: 'object' },
};

const mockProcess = {
  id: 'process-id-123',
  name: 'Test Process',
  processSchema: mockProcessSchema,
  createdByProfileId: 'profile-id-123',
};

const mockInstanceData: InstanceData = {
  currentStateId: 'draft',
  budget: 10000,
  fieldValues: {
    category: 'general',
  },
  stateData: {},
};

describe('createInstance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create an instance successfully', async () => {
    const mockCreatedInstance = {
      id: 'instance-id-123',
      processId: 'process-id-123',
      name: 'Test Instance',
      description: 'A test instance',
      instanceData: mockInstanceData,
      currentStateId: 'draft',
      ownerProfileId: 'profile-id-123',
      status: 'draft',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    // Mock database queries
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(mockDbUser);
    vi.mocked(db.query.decisionProcesses.findFirst).mockResolvedValueOnce(
      mockProcess as any,
    );
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([mockCreatedInstance]),
      }),
    } as any);

    const result = await createInstance({
      data: {
        processId: 'process-id-123',
        name: 'Test Instance',
        description: 'A test instance',
        instanceData: mockInstanceData,
      },
      user: mockUser,
    });

    expect(result).toEqual(mockCreatedInstance);
    expect(db.query.users.findFirst).toHaveBeenCalledWith({
      where: expect.any(Function),
    });
    expect(db.query.decisionProcesses.findFirst).toHaveBeenCalledWith({
      where: expect.any(Function),
    });
    expect(db.insert).toHaveBeenCalled();
  });

  it('should use initial state from process schema', async () => {
    const mockCreatedInstance = {
      id: 'instance-id-123',
      currentStateId: 'draft', // Should match initialState
    };

    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(mockDbUser);
    vi.mocked(db.query.decisionProcesses.findFirst).mockResolvedValueOnce(
      mockProcess as any,
    );
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([mockCreatedInstance]),
      }),
    } as any);

    await createInstance({
      data: {
        processId: 'process-id-123',
        name: 'Test Instance',
        instanceData: mockInstanceData,
      },
      user: mockUser,
    });

    // Verify that the insert was called with the correct initial state
    const insertCall = vi.mocked(db.insert).mock.calls[0];
    const valuesCall = insertCall[0]; // The table argument
    expect(vi.mocked(db.insert().values)).toHaveBeenCalledWith(
      expect.objectContaining({
        currentStateId: 'draft',
      }),
    );
  });

  it('should fall back to first state when initialState not defined', async () => {
    const processWithoutInitialState = {
      ...mockProcess,
      processSchema: {
        ...mockProcessSchema,
        initialState: undefined, // No initial state defined
      },
    };

    const mockCreatedInstance = {
      id: 'instance-id-123',
      currentStateId: 'draft', // Should use first state
    };

    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(mockDbUser);
    vi.mocked(db.query.decisionProcesses.findFirst).mockResolvedValueOnce(
      processWithoutInitialState as any,
    );
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([mockCreatedInstance]),
      }),
    } as any);

    await createInstance({
      data: {
        processId: 'process-id-123',
        name: 'Test Instance',
        instanceData: mockInstanceData,
      },
      user: mockUser,
    });

    expect(vi.mocked(db.insert().values)).toHaveBeenCalledWith(
      expect.objectContaining({
        currentStateId: 'draft', // Should default to first state
      }),
    );
  });

  it('should throw UnauthorizedError when user not authenticated', async () => {
    await expect(
      createInstance({
        data: {
          processId: 'process-id-123',
          name: 'Test Instance',
          instanceData: mockInstanceData,
        },
        user: null as any,
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError when user has no active profile', async () => {
    const userWithoutProfile = { ...mockDbUser, currentProfileId: null };
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(
      userWithoutProfile,
    );

    await expect(
      createInstance({
        data: {
          processId: 'process-id-123',
          name: 'Test Instance',
          instanceData: mockInstanceData,
        },
        user: mockUser,
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should throw NotFoundError when process not found', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(mockDbUser);
    vi.mocked(db.query.decisionProcesses.findFirst).mockResolvedValueOnce(null);

    await expect(
      createInstance({
        data: {
          processId: 'nonexistent-process',
          name: 'Test Instance',
          instanceData: mockInstanceData,
        },
        user: mockUser,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw CommonError when database insert fails', async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(mockDbUser);
    vi.mocked(db.query.decisionProcesses.findFirst).mockResolvedValueOnce(
      mockProcess as any,
    );
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([]), // Empty array = no result
      }),
    } as any);

    await expect(
      createInstance({
        data: {
          processId: 'process-id-123',
          name: 'Test Instance',
          instanceData: mockInstanceData,
        },
        user: mockUser,
      }),
    ).rejects.toThrow(CommonError);
  });

  it('should handle database connection errors', async () => {
    vi.mocked(db.query.users.findFirst).mockRejectedValueOnce(
      new Error('Database connection failed'),
    );

    await expect(
      createInstance({
        data: {
          processId: 'process-id-123',
          name: 'Test Instance',
          instanceData: mockInstanceData,
        },
        user: mockUser,
      }),
    ).rejects.toThrow(CommonError);
  });

  it('should validate instance data structure', async () => {
    const invalidInstanceData = {
      // Missing required currentStateId
      budget: 10000,
    } as any;

    vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(mockDbUser);
    vi.mocked(db.query.decisionProcesses.findFirst).mockResolvedValueOnce(
      mockProcess as any,
    );

    // This would typically be caught by TypeScript or validation at the API layer
    // but we test that the service handles it gracefully
    await expect(
      createInstance({
        data: {
          processId: 'process-id-123',
          name: 'Test Instance',
          instanceData: invalidInstanceData,
        },
        user: mockUser,
      }),
    ).rejects.toThrow(); // Should fail validation
  });
});
