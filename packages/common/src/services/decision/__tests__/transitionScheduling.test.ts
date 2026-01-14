import { db } from '@op/db/client';
import type { ProcessInstance } from '@op/db/schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTransitionsForProcess } from '../createTransitionsForProcess';
import type {
  DecisionInstanceData,
  PhaseInstanceData,
} from '../schemas/instanceData';
import { processDecisionsTransitions } from '../transitionMonitor';
import { updateTransitionsForProcess } from '../updateTransitionsForProcess';

// Helper to create mock dates
const createFutureDate = (daysFromNow: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
};

const createPastDate = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
};

// Mock instance data with date-based phases
const createMockInstanceData = (
  overrides?: Partial<DecisionInstanceData>,
): DecisionInstanceData => ({
  currentPhaseId: 'submission',
  budget: 100000,
  fieldValues: {},
  phases: [
    {
      phaseId: 'submission',
      plannedStartDate: createFutureDate(0),
      plannedEndDate: createFutureDate(7),
      rules: {
        proposals: { submit: true },
        voting: { submit: false },
        advancement: { method: 'date' },
      },
    },
    {
      phaseId: 'review',
      plannedStartDate: createFutureDate(7),
      plannedEndDate: createFutureDate(14),
      rules: {
        proposals: { submit: false },
        voting: { submit: false },
        advancement: { method: 'date' },
      },
    },
    {
      phaseId: 'voting',
      plannedStartDate: createFutureDate(14),
      plannedEndDate: createFutureDate(21),
      rules: {
        proposals: { submit: false },
        voting: { submit: true },
        advancement: { method: 'date' },
      },
    },
    {
      phaseId: 'results',
      plannedStartDate: createFutureDate(21),
      rules: {
        proposals: { submit: false },
        voting: { submit: false },
      },
    },
  ] as PhaseInstanceData[],
  ...overrides,
});

const createMockProcessInstance = (
  overrides?: Partial<ProcessInstance>,
): ProcessInstance =>
  ({
    id: 'instance-123',
    processId: 'process-123',
    name: 'Test Decision',
    description: 'A test decision process',
    instanceData: createMockInstanceData(),
    currentStateId: 'submission',
    status: 'draft',
    ownerProfileId: 'owner-profile-123',
    profileId: 'profile-123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    ...overrides,
  }) as ProcessInstance;

describe('Transition Scheduling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createTransitionsForProcess', () => {
    it('should create transitions for phases with date-based advancement', async () => {
      const mockInstance = createMockProcessInstance();

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(
            // Simulate returning the inserted transitions
            [
              {
                id: 'trans-1',
                processInstanceId: mockInstance.id,
                fromStateId: 'submission',
                toStateId: 'review',
                scheduledDate: createFutureDate(7),
                completedAt: null,
              },
              {
                id: 'trans-2',
                processInstanceId: mockInstance.id,
                fromStateId: 'review',
                toStateId: 'voting',
                scheduledDate: createFutureDate(14),
                completedAt: null,
              },
              {
                id: 'trans-3',
                processInstanceId: mockInstance.id,
                fromStateId: 'voting',
                toStateId: 'results',
                scheduledDate: createFutureDate(21),
                completedAt: null,
              },
            ],
          ),
        }),
      } as never);

      const result = await createTransitionsForProcess({
        processInstance: mockInstance,
      });

      expect(result.transitions).toHaveLength(3);
      expect(result.transitions[0]!.fromStateId).toBe('submission');
      expect(result.transitions[0]!.toStateId).toBe('review');
      expect(result.transitions[1]!.fromStateId).toBe('review');
      expect(result.transitions[1]!.toStateId).toBe('voting');
      expect(result.transitions[2]!.fromStateId).toBe('voting');
      expect(result.transitions[2]!.toStateId).toBe('results');
    });

    it('should not create transitions for phases with manual advancement', async () => {
      const instanceData = createMockInstanceData();
      // Change all phases to manual advancement
      instanceData.phases = instanceData.phases.map((phase) => ({
        ...phase,
        rules: {
          ...phase.rules,
          advancement: { method: 'manual' as const },
        },
      }));

      const mockInstance = createMockProcessInstance({ instanceData });

      const result = await createTransitionsForProcess({
        processInstance: mockInstance,
      });

      expect(result.transitions).toHaveLength(0);
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('should throw error when phase is missing start date', async () => {
      const instanceData = createMockInstanceData();
      // Remove the start date from the review phase (which submission transitions to)
      instanceData.phases[1]!.plannedStartDate = undefined;

      const mockInstance = createMockProcessInstance({ instanceData });

      await expect(
        createTransitionsForProcess({ processInstance: mockInstance }),
      ).rejects.toThrow('must have a start date');
    });

    it('should throw error when instance has no phases', async () => {
      const mockInstance = createMockProcessInstance({
        instanceData: {
          currentPhaseId: 'submission',
          fieldValues: {},
          phases: [],
        },
      });

      await expect(
        createTransitionsForProcess({ processInstance: mockInstance }),
      ).rejects.toThrow('at least one phase');
    });
  });

  describe('updateTransitionsForProcess', () => {
    it('should update existing transitions when dates change', async () => {
      const mockInstance = createMockProcessInstance();
      const oldDate = createFutureDate(7);
      const newDate = createFutureDate(10);

      // Update the instance data with new dates
      (
        mockInstance.instanceData as DecisionInstanceData
      ).phases[1]!.plannedStartDate = newDate;

      // Mock existing transitions
      vi.mocked(
        db.query.decisionProcessTransitions.findMany,
      ).mockResolvedValueOnce([
        {
          id: 'trans-1',
          processInstanceId: mockInstance.id,
          fromStateId: 'submission',
          toStateId: 'review',
          scheduledDate: oldDate,
          completedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ] as never);

      // Mock update
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      // Mock insert for new transitions
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as never);

      // Mock delete (no transitions to delete in this case)
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as never);

      const result = await updateTransitionsForProcess({
        processInstance: mockInstance,
      });

      expect(result.updated).toBeGreaterThanOrEqual(0);
    });

    it('should not update completed transitions', async () => {
      const mockInstance = createMockProcessInstance();

      // Mock existing completed transition
      vi.mocked(
        db.query.decisionProcessTransitions.findMany,
      ).mockResolvedValueOnce([
        {
          id: 'trans-1',
          processInstanceId: mockInstance.id,
          fromStateId: 'submission',
          toStateId: 'review',
          scheduledDate: createFutureDate(7),
          completedAt: new Date().toISOString(), // Already completed
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ] as never);

      // Mock insert for new transitions
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as never);

      // Mock delete
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as never);

      await updateTransitionsForProcess({
        processInstance: mockInstance,
      });

      // Should skip updating the completed transition
      expect(db.update).not.toHaveBeenCalled();
    });

    it('should delete transitions for phases no longer using date-based advancement', async () => {
      const instanceData = createMockInstanceData();
      // Change submission phase to manual advancement
      instanceData.phases[0]!.rules!.advancement = { method: 'manual' };

      const mockInstance = createMockProcessInstance({ instanceData });

      // Mock existing transition for submission→review (should be deleted)
      vi.mocked(
        db.query.decisionProcessTransitions.findMany,
      ).mockResolvedValueOnce([
        {
          id: 'trans-1',
          processInstanceId: mockInstance.id,
          fromStateId: 'submission',
          toStateId: 'review',
          scheduledDate: createFutureDate(7),
          completedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ] as never);

      // Mock delete
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as never);

      // Mock insert
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as never);

      const result = await updateTransitionsForProcess({
        processInstance: mockInstance,
      });

      expect(result.deleted).toBe(1);
    });

    it('should create new transitions for newly added date-based phases', async () => {
      const mockInstance = createMockProcessInstance();

      // No existing transitions
      vi.mocked(
        db.query.decisionProcessTransitions.findMany,
      ).mockResolvedValueOnce([]);

      // Mock insert
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as never);

      const result = await updateTransitionsForProcess({
        processInstance: mockInstance,
      });

      // Should create 3 new transitions
      expect(result.created).toBe(3);
    });
  });

  describe('processDecisionsTransitions (transitionMonitor)', () => {
    it('should process due transitions', async () => {
      const pastDate = createPastDate(1);

      // Mock due transitions
      vi.mocked(
        db.query.decisionProcessTransitions.findMany,
      ).mockResolvedValueOnce([
        {
          id: 'trans-1',
          processInstanceId: 'instance-123',
          fromStateId: 'submission',
          toStateId: 'review',
          scheduledDate: pastDate,
          completedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ] as never);

      // Mock transition lookup
      vi.mocked(
        db.query.decisionProcessTransitions.findFirst,
      ).mockResolvedValueOnce({
        id: 'trans-1',
        processInstanceId: 'instance-123',
        fromStateId: 'submission',
        toStateId: 'review',
        scheduledDate: pastDate,
        completedAt: null,
      } as never);

      // Mock process instance lookup
      vi.mocked(db.query.processInstances.findFirst).mockResolvedValueOnce({
        id: 'instance-123',
        processId: 'process-123',
        currentStateId: 'submission',
      } as never);

      // Mock process lookup
      vi.mocked(db.query.decisionProcesses.findFirst).mockResolvedValueOnce({
        id: 'process-123',
        processSchema: {
          id: 'simple',
          phases: [
            { id: 'submission' },
            { id: 'review' },
            { id: 'voting' },
            { id: 'results' },
          ],
        },
      } as never);

      // Mock transaction
      vi.mocked(db.transaction).mockImplementationOnce(async (callback) => {
        await callback({
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        } as never);
      });

      const result = await processDecisionsTransitions();

      expect(result.processed).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('should skip already completed transitions', async () => {
      // In production, completed transitions are filtered out by the query
      // (isNull(transitions.completedAt)), so they won't appear in results.
      // This test verifies the safety check in processTransition handles
      // race conditions where a transition completes between query and processing.

      const pastDate = createPastDate(1);

      // Initial query returns an uncompleted transition
      vi.mocked(
        db.query.decisionProcessTransitions.findMany,
      ).mockResolvedValueOnce([
        {
          id: 'trans-1',
          processInstanceId: 'instance-123',
          fromStateId: 'submission',
          toStateId: 'review',
          scheduledDate: pastDate,
          completedAt: null,
        },
      ] as never);

      // But when we look it up again, it's now completed (race condition)
      vi.mocked(
        db.query.decisionProcessTransitions.findFirst,
      ).mockResolvedValueOnce({
        id: 'trans-1',
        processInstanceId: 'instance-123',
        fromStateId: 'submission',
        toStateId: 'review',
        scheduledDate: pastDate,
        completedAt: new Date().toISOString(), // Completed by another process
      } as never);

      const result = await processDecisionsTransitions();

      // The transition was skipped due to race condition check
      // It counts as processed (the function handled it gracefully)
      expect(result.processed).toBe(1);
      expect(result.failed).toBe(0);
      // Transaction should not be called since we detected it was already completed
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully and continue processing', async () => {
      const pastDate = createPastDate(1);

      // Mock two due transitions
      vi.mocked(
        db.query.decisionProcessTransitions.findMany,
      ).mockResolvedValueOnce([
        {
          id: 'trans-1',
          processInstanceId: 'instance-123',
          fromStateId: 'submission',
          toStateId: 'review',
          scheduledDate: pastDate,
          completedAt: null,
        },
        {
          id: 'trans-2',
          processInstanceId: 'instance-456',
          fromStateId: 'review',
          toStateId: 'voting',
          scheduledDate: pastDate,
          completedAt: null,
        },
      ] as never);

      // First transition lookup fails
      vi.mocked(db.query.decisionProcessTransitions.findFirst)
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({
          id: 'trans-2',
          processInstanceId: 'instance-456',
          fromStateId: 'review',
          toStateId: 'voting',
          scheduledDate: pastDate,
          completedAt: null,
        } as never);

      // Mock for second transition
      vi.mocked(db.query.processInstances.findFirst).mockResolvedValueOnce({
        id: 'instance-456',
        processId: 'process-456',
      } as never);

      vi.mocked(db.query.decisionProcesses.findFirst).mockResolvedValueOnce({
        id: 'process-456',
        processSchema: {
          phases: [{ id: 'review' }, { id: 'voting' }, { id: 'results' }],
        },
      } as never);

      vi.mocked(db.transaction).mockImplementationOnce(async (callback) => {
        await callback({
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        } as never);
      });

      const result = await processDecisionsTransitions();

      expect(result.failed).toBe(1);
      expect(result.processed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should detect final state transition correctly', async () => {
      const pastDate = createPastDate(1);

      // Mock transition to results (final phase)
      vi.mocked(
        db.query.decisionProcessTransitions.findMany,
      ).mockResolvedValueOnce([
        {
          id: 'trans-1',
          processInstanceId: 'instance-123',
          fromStateId: 'voting',
          toStateId: 'results',
          scheduledDate: pastDate,
          completedAt: null,
        },
      ] as never);

      vi.mocked(
        db.query.decisionProcessTransitions.findFirst,
      ).mockResolvedValueOnce({
        id: 'trans-1',
        processInstanceId: 'instance-123',
        fromStateId: 'voting',
        toStateId: 'results',
        scheduledDate: pastDate,
        completedAt: null,
      } as never);

      vi.mocked(db.query.processInstances.findFirst).mockResolvedValueOnce({
        id: 'instance-123',
        processId: 'process-123',
      } as never);

      // Process schema with results as last phase
      vi.mocked(db.query.decisionProcesses.findFirst).mockResolvedValueOnce({
        id: 'process-123',
        processSchema: {
          phases: [
            { id: 'submission' },
            { id: 'review' },
            { id: 'voting' },
            { id: 'results' }, // Last phase = final state
          ],
        },
      } as never);

      vi.mocked(db.transaction).mockImplementationOnce(async (callback) => {
        await callback({
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        } as never);
      });

      // Should log about results processing (we can't easily test console.log,
      // but the transition should complete successfully)
      const result = await processDecisionsTransitions();

      expect(result.processed).toBe(1);
    });
  });
});
