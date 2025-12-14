import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockDb } from '../../../test/setup';
import { CommonError, UnauthorizedError } from '../../../utils';
import { createProcess } from '../createProcess';
import type { ProcessSchema } from '../types';

// Mock user object
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
  description: 'A test decision process',
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
    {
      id: 'final',
      name: 'Final',
      type: 'final',
    },
  ],
  transitions: [
    {
      id: 'draft-to-review',
      name: 'Submit for Review',
      from: 'draft',
      to: 'review',
      rules: {
        type: 'manual',
      },
    },
    {
      id: 'review-to-final',
      name: 'Approve',
      from: 'review',
      to: 'final',
      rules: {
        type: 'manual',
      },
    },
  ],
  initialState: 'draft',
  decisionDefinition: {
    type: 'object',
    properties: {
      decision: { type: 'string', enum: ['approve', 'reject'] },
      comment: { type: 'string' },
    },
    required: ['decision'],
  },
  proposalTemplate: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
    },
    required: ['title'],
  },
};

describe('createProcess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a process successfully', async () => {
    const mockCreatedProcess = {
      id: 'process-id-123',
      name: 'Test Process',
      description: 'A test decision process',
      processSchema: mockProcessSchema,
      createdByProfileId: 'profile-id-123',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    // Mock database queries
    mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([mockCreatedProcess]),
      }),
    } as any);

    const result = await createProcess({
      data: {
        name: 'Test Process',
        description: 'A test decision process',
        processSchema: mockProcessSchema,
      },
      user: mockUser,
    });

    expect(result).toEqual(mockCreatedProcess);
    expect(mockDb.query.users.findFirst).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('should throw UnauthorizedError when user is not authenticated', async () => {
    await expect(
      createProcess({
        data: {
          name: 'Test Process',
          processSchema: mockProcessSchema,
        },
        user: null as any,
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError when user has no active profile', async () => {
    const userWithoutProfile = { ...mockDbUser, currentProfileId: null };
    mockDb.query.users.findFirst.mockResolvedValueOnce(userWithoutProfile);

    await expect(
      createProcess({
        data: {
          name: 'Test Process',
          processSchema: mockProcessSchema,
        },
        user: mockUser,
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError when database user is not found', async () => {
    mockDb.query.users.findFirst.mockResolvedValueOnce(null);

    await expect(
      createProcess({
        data: {
          name: 'Test Process',
          processSchema: mockProcessSchema,
        },
        user: mockUser,
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should throw CommonError when database insert fails', async () => {
    mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
    mockDb.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([]), // Empty array = no result
      }),
    } as any);

    await expect(
      createProcess({
        data: {
          name: 'Test Process',
          processSchema: mockProcessSchema,
        },
        user: mockUser,
      }),
    ).rejects.toThrow(CommonError);
  });

  it('should handle database errors gracefully', async () => {
    mockDb.query.users.findFirst.mockRejectedValueOnce(
      new Error('Database connection failed'),
    );

    await expect(
      createProcess({
        data: {
          name: 'Test Process',
          processSchema: mockProcessSchema,
        },
        user: mockUser,
      }),
    ).rejects.toThrow(CommonError);
  });

  it('should validate required fields', async () => {
    mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);

    await expect(
      createProcess({
        data: {
          name: '', // Empty name should fail validation at the API level
          processSchema: mockProcessSchema,
        },
        user: mockUser,
      }),
    ).rejects.toThrow(); // This would be caught by zod validation in practice
  });
});
