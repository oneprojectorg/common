import { db, eq } from '@op/db/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../utils';
import { TransitionEngine } from '../transitionEngine';
import type {
  InstanceData,
  ProcessSchema,
  TransitionCondition,
} from '../types';

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
    {
      id: 'approved',
      name: 'Approved',
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
        conditions: [
          {
            type: 'proposalCount',
            operator: 'greaterThan',
            value: 0,
          },
        ],
      },
    },
    {
      id: 'review-to-approved',
      name: 'Approve',
      from: 'review',
      to: 'approved',
      rules: {
        type: 'manual',
        conditions: [
          {
            type: 'time',
            operator: 'greaterThan',
            value: 86400000, // 24 hours in milliseconds
          },
        ],
      },
    },
  ],
  initialState: 'draft',
  decisionDefinition: { type: 'object' },
  proposalTemplate: { type: 'object' },
};

const mockInstanceData: InstanceData = {
  currentStateId: 'draft',
  stateData: {
    draft: {
      enteredAt: '2024-01-01T00:00:00Z',
      metadata: {},
    },
  },
  fieldValues: {},
};

const mockInstance = {
  id: 'instance-id-123',
  processId: 'process-id-123',
  name: 'Test Instance',
  instanceData: mockInstanceData,
  currentStateId: 'draft',
  process: {
    id: 'process-id-123',
    processSchema: mockProcessSchema,
  },
  owner: mockDbUser,
};

describe('TransitionEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkAvailableTransitions', () => {
    it('should return available transitions for current state', async () => {
      vi.mocked(db.query.processInstances.findFirst).mockResolvedValueOnce(
        mockInstance as any,
      );
      vi.mocked(db.$count).mockResolvedValueOnce(5); // 5 proposals

      const result = await TransitionEngine.checkAvailableTransitions({
        instanceId: 'instance-id-123',
        user: mockUser,
      });

      expect(result.canTransition).toBe(true);
      expect(result.availableTransitions).toHaveLength(1);
      expect(result.availableTransitions[0].toStateId).toBe('review');
      expect(result.availableTransitions[0].canExecute).toBe(true);
    });

    it('should return false when conditions are not met', async () => {
      vi.mocked(db.query.processInstances.findFirst).mockResolvedValueOnce(
        mockInstance as any,
      );
      vi.mocked(db.$count).mockResolvedValueOnce(0); // No proposals

      const result = await TransitionEngine.checkAvailableTransitions({
        instanceId: 'instance-id-123',
        user: mockUser,
      });

      expect(result.canTransition).toBe(false);
      expect(result.availableTransitions[0].canExecute).toBe(false);
      expect(result.availableTransitions[0].failedRules).toHaveLength(1);
    });

    it('should filter to specific transition when toStateId provided', async () => {
      vi.mocked(db.query.processInstances.findFirst).mockResolvedValueOnce(
        mockInstance as any,
      );
      vi.mocked(db.$count).mockResolvedValueOnce(5);

      const result = await TransitionEngine.checkAvailableTransitions({
        instanceId: 'instance-id-123',
        toStateId: 'review',
        user: mockUser,
      });

      expect(result.availableTransitions).toHaveLength(1);
      expect(result.availableTransitions[0].toStateId).toBe('review');
    });

    it('should throw NotFoundError when instance not found', async () => {
      vi.mocked(db.query.processInstances.findFirst).mockResolvedValueOnce(
        null,
      );

      await expect(
        TransitionEngine.checkAvailableTransitions({
          instanceId: 'nonexistent-id',
          user: mockUser,
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw UnauthorizedError when user not authenticated', async () => {
      await expect(
        TransitionEngine.checkAvailableTransitions({
          instanceId: 'instance-id-123',
          user: null as any,
        }),
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('executeTransition', () => {
    it('should execute valid transition successfully', async () => {
      const updatedInstance = {
        ...mockInstance,
        currentStateId: 'review',
        instanceData: {
          ...mockInstanceData,
          currentStateId: 'review',
        },
      };

      // Mock transition check to return success
      vi.mocked(db.query.processInstances.findFirst)
        .mockResolvedValueOnce(mockInstance as any) // For checkAvailableTransitions
        .mockResolvedValueOnce(mockInstance as any) // For executeTransition
        .mockResolvedValueOnce(updatedInstance as any); // Final result

      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(mockDbUser);
      vi.mocked(db.$count).mockResolvedValueOnce(5); // Proposals count

      // Mock transaction
      vi.mocked(db.transaction).mockImplementationOnce(async (callback) => {
        await callback({
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn(),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn(),
          }),
        } as any);
      });

      const result = await TransitionEngine.executeTransition({
        data: {
          instanceId: 'instance-id-123',
          toStateId: 'review',
        },
        user: mockUser,
      });

      expect(result).toEqual(updatedInstance);
      expect(db.transaction).toHaveBeenCalled();
    });

    it('should throw ValidationError when transition is not allowed', async () => {
      vi.mocked(db.query.processInstances.findFirst).mockResolvedValueOnce(
        mockInstance as any,
      );
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce(mockDbUser);
      vi.mocked(db.$count).mockResolvedValueOnce(0); // No proposals - condition fails

      await expect(
        TransitionEngine.executeTransition({
          data: {
            instanceId: 'instance-id-123',
            toStateId: 'review',
          },
          user: mockUser,
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('condition evaluation', () => {
    it('should evaluate time conditions correctly', () => {
      const pastCondition: TransitionCondition = {
        type: 'time',
        operator: 'greaterThan',
        value: 3600000, // 1 hour ago
      };

      const instanceWithTime: InstanceData = {
        currentStateId: 'draft',
        stateData: {
          draft: {
            enteredAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
          },
        },
      };

      const result = (TransitionEngine as any).evaluateTimeCondition(
        pastCondition,
        instanceWithTime,
      );

      expect(result).toBe(true);
    });

    it('should evaluate custom field conditions correctly', () => {
      const fieldCondition: TransitionCondition = {
        type: 'customField',
        operator: 'equals',
        value: 'approved',
        field: 'status',
      };

      const instanceWithField: InstanceData = {
        currentStateId: 'review',
        fieldValues: {
          status: 'approved',
        },
      };

      const result = (TransitionEngine as any).evaluateCustomFieldCondition(
        fieldCondition,
        instanceWithField,
      );

      expect(result).toBe(true);
    });

    it('should return false for missing time data', () => {
      const timeCondition: TransitionCondition = {
        type: 'time',
        operator: 'greaterThan',
        value: 3600000,
      };

      const instanceWithoutTime: InstanceData = {
        currentStateId: 'draft',
        stateData: {},
      };

      const result = (TransitionEngine as any).evaluateTimeCondition(
        timeCondition,
        instanceWithoutTime,
      );

      expect(result).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      vi.mocked(db.query.processInstances.findFirst).mockRejectedValueOnce(
        new Error('Database connection failed'),
      );

      await expect(
        TransitionEngine.checkAvailableTransitions({
          instanceId: 'instance-id-123',
          user: mockUser,
        }),
      ).rejects.toThrow('Failed to check transitions');
    });

    it('should provide helpful error messages for failed conditions', () => {
      const condition: TransitionCondition = {
        type: 'proposalCount',
        operator: 'greaterThan',
        value: 5,
      };

      const errorMessage = (TransitionEngine as any).getConditionErrorMessage(
        condition,
      );
      expect(errorMessage).toContain('Proposal count condition not met');
      expect(errorMessage).toContain('greaterThan 5');
    });
  });
});
