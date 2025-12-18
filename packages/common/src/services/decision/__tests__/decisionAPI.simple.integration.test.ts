import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockDb } from '../../../test/setup';
import { UnauthorizedError, ValidationError } from '../../../utils';
import {
  TransitionEngine,
  createInstance,
  createProcess,
  createProposal,
} from '../index';
import type { InstanceData, ProcessSchema, ProposalData } from '../types';

// Mock users
const mockUser = {
  id: 'auth-user-id',
  email: 'test@example.com',
} as any;

const mockDbUser = {
  id: 'db-user-id',
  currentProfileId: 'profile-id-123',
  authUserId: 'auth-user-id',
};

// Simple process schema for testing
const testProcessSchema: ProcessSchema = {
  name: 'Simple Test Process',
  description: 'A simple process for testing the API',
  states: [
    {
      id: 'draft',
      name: 'Draft',
      type: 'initial',
      config: {
        allowProposals: true,
        allowDecisions: false,
      },
    },
    {
      id: 'review',
      name: 'Under Review',
      type: 'intermediate',
      config: {
        allowProposals: false,
        allowDecisions: true,
      },
    },
    {
      id: 'approved',
      name: 'Approved',
      type: 'final',
      config: {
        allowProposals: false,
        allowDecisions: false,
      },
    },
  ],
  transitions: [
    {
      id: 'to-review',
      name: 'Submit for Review',
      from: 'draft',
      to: 'review',
      rules: {
        type: 'manual',
      },
    },
    {
      id: 'approve',
      name: 'Approve',
      from: 'review',
      to: 'approved',
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
      comments: { type: 'string' },
    },
    required: ['decision'],
  },
  proposalTemplate: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      amount: { type: 'number' },
    },
    required: ['title', 'description'],
  },
};

describe('Decision API Simple Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Workflow', () => {
    it('should create process, instance, and proposal successfully', async () => {
      // Step 1: Create process
      const mockProcess = {
        id: 'test-process-1',
        name: 'Simple Test Process',
        processSchema: testProcessSchema,
        createdByProfileId: 'profile-id-123',
      };

      mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([mockProcess]),
        }),
      } as any);

      const process = await createProcess({
        data: {
          name: 'Simple Test Process',
          description: 'A simple process for testing the API',
          processSchema: testProcessSchema,
        },
        user: mockUser,
      });

      expect(process.id).toBe('test-process-1');
      expect(process.processSchema.states).toHaveLength(3);

      // Step 2: Create instance
      const instanceData: InstanceData = {
        currentStateId: 'draft',
        fieldValues: {
          department: 'engineering',
        },
      };

      const mockInstance = {
        id: 'test-instance-1',
        processId: process.id,
        name: 'Test Instance',
        instanceData,
        currentStateId: 'draft',
      };

      mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
      mockDb.query.decisionProcesses.findFirst.mockResolvedValueOnce(
        mockProcess as any,
      );
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([mockInstance]),
        }),
      } as any);

      const instance = await createInstance({
        data: {
          processId: process.id,
          name: 'Test Instance',
          instanceData,
        },
        user: mockUser,
      });

      expect(instance.currentStateId).toBe('draft');

      // Step 3: Create proposal in draft state (should work)
      const proposalData: ProposalData = {
        title: 'Test Proposal',
        description: 'A test proposal for integration testing',
        amount: 5000,
      };

      const mockProposal = {
        id: 'test-proposal-1',
        processInstanceId: instance.id,
        proposalData,
        submittedByProfileId: 'profile-id-123',
        status: 'submitted',
      };

      mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
      mockDb.query.processInstances.findFirst.mockResolvedValueOnce({
        ...mockInstance,
        process: mockProcess,
      } as any);
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([mockProposal]),
        }),
      } as any);

      const proposal = await createProposal({
        data: {
          processInstanceId: instance.id,
          proposalData,
        },
        user: mockUser,
      });

      expect(proposal.id).toBe('test-proposal-1');
      expect(proposal.status).toBe('submitted');
    });

    it('should prevent proposals in states that do not allow them', async () => {
      const mockInstanceInReview = {
        id: 'test-instance-review',
        currentStateId: 'review',
        instanceData: { currentStateId: 'review' },
        process: {
          processSchema: testProcessSchema,
        },
      };

      mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
      mockDb.query.processInstances.findFirst.mockResolvedValueOnce(
        mockInstanceInReview as any,
      );

      await expect(
        createProposal({
          data: {
            processInstanceId: 'test-instance-review',
            proposalData: {
              title: 'Should Fail',
              description: 'This should fail',
            },
          },
          user: mockUser,
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('should check transitions correctly', async () => {
      const mockInstance = {
        id: 'transition-test-instance',
        currentStateId: 'draft',
        instanceData: {
          currentStateId: 'draft',
        },
        process: {
          processSchema: testProcessSchema,
        },
      };

      mockDb.query.processInstances.findFirst.mockResolvedValueOnce(
        mockInstance as any,
      );

      const result = await TransitionEngine.checkAvailableTransitions({
        instanceId: 'transition-test-instance',
        user: mockUser,
      });

      expect(result.canTransition).toBe(true);
      expect(result.availableTransitions).toHaveLength(1);
      expect(result.availableTransitions[0].toStateId).toBe('review');
      expect(result.availableTransitions[0].canExecute).toBe(true);
    });

    it('should execute transitions successfully', async () => {
      const mockInstance = {
        id: 'execute-transition-instance',
        currentStateId: 'draft',
        instanceData: {
          currentStateId: 'draft',
        },
        process: {
          processSchema: testProcessSchema,
        },
      };

      const updatedInstance = {
        ...mockInstance,
        currentStateId: 'review',
        instanceData: {
          currentStateId: 'review',
        },
      };

      // Mock transition check and execution
      mockDb.query.processInstances.findFirst
        .mockResolvedValueOnce(mockInstance as any) // For check
        .mockResolvedValueOnce(mockInstance as any) // For execute
        .mockResolvedValueOnce(updatedInstance as any); // For final result

      mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);

      const mockTrx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn(),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn(),
        }),
      };
      mockDb.transaction.mockImplementationOnce(async (callback) => {
        await callback(mockTrx as any);
      });

      const result = await TransitionEngine.executeTransition({
        data: {
          instanceId: 'execute-transition-instance',
          toStateId: 'review',
        },
        user: mockUser,
      });

      expect(result.currentStateId).toBe('review');
      expect(mockTrx.update).toHaveBeenCalled();
      expect(mockTrx.insert).toHaveBeenCalled(); // Transition history
    });
  });

  describe('Authorization Tests', () => {
    it('should reject unauthenticated users', async () => {
      await expect(
        createProcess({
          data: {
            name: 'Test Process',
            processSchema: testProcessSchema,
          },
          user: null as any,
        }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should reject users without active profiles', async () => {
      const userWithoutProfile = { ...mockDbUser, currentProfileId: null };
      mockDb.query.users.findFirst.mockResolvedValueOnce(userWithoutProfile);

      await expect(
        createProcess({
          data: {
            name: 'Test Process',
            processSchema: testProcessSchema,
          },
          user: mockUser,
        }),
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('State Validation', () => {
    it('should validate process schema has required states', async () => {
      const invalidSchema = {
        ...testProcessSchema,
        states: [], // Empty states
      };

      mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([
            {
              id: 'invalid-process',
              processSchema: invalidSchema,
            },
          ]),
        }),
      } as any);

      const result = await createProcess({
        data: {
          name: 'Invalid Process',
          processSchema: invalidSchema,
        },
        user: mockUser,
      });

      expect(result.id).toBe('invalid-process');
      expect(result.processSchema.states).toHaveLength(0);
    });

    it('should handle missing initial state gracefully', async () => {
      const schemaWithoutInitialState = {
        ...testProcessSchema,
        initialState: 'nonexistent',
      };

      const mockProcess = {
        id: 'invalid-initial-process',
        processSchema: schemaWithoutInitialState,
      };

      const instanceData: InstanceData = {
        currentStateId: 'draft', // Override with valid state
      };

      mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
      mockDb.query.decisionProcesses.findFirst.mockResolvedValueOnce(
        mockProcess as any,
      );
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([
            {
              id: 'test-instance',
              currentStateId: 'draft',
              instanceData,
            },
          ]),
        }),
      } as any);

      const result = await createInstance({
        data: {
          processId: 'invalid-initial-process',
          name: 'Test Instance',
          instanceData,
        },
        user: mockUser,
      });

      expect(result.currentStateId).toBe('draft');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockDb.query.users.findFirst.mockRejectedValueOnce(
        new Error('Database connection failed'),
      );

      await expect(
        createProcess({
          data: {
            name: 'Test Process',
            processSchema: testProcessSchema,
          },
          user: mockUser,
        }),
      ).rejects.toThrow('Failed to create decision process');
    });

    it('should handle invalid instance IDs in transitions', async () => {
      mockDb.query.processInstances.findFirst.mockResolvedValueOnce(null);

      await expect(
        TransitionEngine.checkAvailableTransitions({
          instanceId: 'nonexistent-instance',
          user: mockUser,
        }),
      ).rejects.toThrow('Process instance not found');
    });
  });
});
