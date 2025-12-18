import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockDb } from '../../../test/setup';
import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../utils';
import {
  TransitionEngine,
  checkTransitions,
  createInstance,
  createProcess,
  createProposal,
  deleteProposal,
  executeTransition,
  getProcess,
  getProposal,
  listProcesses,
  listProposals,
  updateProcess,
  updateProposal,
} from '../index';
import type { InstanceData, ProcessSchema, ProposalData } from '../types';

// Mock users
const mockUser = {
  id: 'auth-user-id',
  email: 'test@example.com',
} as any;

const mockUser2 = {
  id: 'auth-user-id-2',
  email: 'test2@example.com',
} as any;

const mockDbUser = {
  id: 'db-user-id',
  currentProfileId: 'profile-id-123',
  authUserId: 'auth-user-id',
};

const mockDbUser2 = {
  id: 'db-user-id-2',
  currentProfileId: 'profile-id-456',
  authUserId: 'auth-user-id-2',
};

// Sample process schemas for testing
const simpleProcessSchema: ProcessSchema = {
  name: 'Simple Approval Process',
  description: 'A basic two-state approval process',
  states: [
    {
      id: 'pending',
      name: 'Pending',
      type: 'initial',
      config: {
        allowProposals: true,
        allowDecisions: false,
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
      id: 'approve',
      name: 'Approve',
      from: 'pending',
      to: 'approved',
      rules: {
        type: 'manual',
      },
    },
  ],
  initialState: 'pending',
  decisionDefinition: {
    type: 'object',
    properties: {
      approved: { type: 'boolean' },
      comments: { type: 'string' },
    },
    required: ['approved'],
  },
  proposalTemplate: {
    type: 'object',
    properties: {
      title: { type: 'string', minLength: 5 },
      amount: { type: 'number', minimum: 0 },
    },
    required: ['title', 'amount'],
  },
};

const complexProcessSchema: ProcessSchema = {
  name: 'Multi-Stage Review Process',
  description: 'A complex process with multiple stages and conditions',
  budget: 100000,
  fields: {
    type: 'object',
    properties: {
      department: {
        type: 'string',
        enum: ['engineering', 'marketing', 'sales'],
      },
      priority: { type: 'string', enum: ['low', 'medium', 'high'] },
    },
  },
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
      fields: {
        type: 'object',
        properties: {
          reviewerNotes: { type: 'string' },
        },
      },
    },
    {
      id: 'approved',
      name: 'Approved',
      type: 'final',
    },
    {
      id: 'rejected',
      name: 'Rejected',
      type: 'final',
    },
  ],
  transitions: [
    {
      id: 'submit',
      name: 'Submit for Review',
      from: 'draft',
      to: 'review',
      rules: {
        type: 'automatic',
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
      id: 'approve',
      name: 'Approve',
      from: 'review',
      to: 'approved',
      rules: {
        type: 'manual',
        conditions: [
          {
            type: 'customField',
            operator: 'equals',
            field: 'reviewComplete',
            value: true,
          },
        ],
      },
      actions: [
        {
          type: 'updateField',
          config: {
            field: 'approvedAt',
            value: 'current_timestamp',
          },
        },
      ],
    },
    {
      id: 'reject',
      name: 'Reject',
      from: 'review',
      to: 'rejected',
      rules: {
        type: 'manual',
      },
    },
  ],
  initialState: 'draft',
  decisionDefinition: {
    type: 'object',
    properties: {
      decision: {
        type: 'string',
        enum: ['approve', 'reject', 'request_changes'],
      },
      comments: { type: 'string', minLength: 10 },
    },
    required: ['decision', 'comments'],
  },
  proposalTemplate: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      requestedAmount: { type: 'number' },
      justification: { type: 'string' },
    },
    required: ['title', 'description', 'requestedAmount'],
  },
};

describe('Decision API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Process Management', () => {
    describe('createProcess', () => {
      it('should create a simple process successfully', async () => {
        const mockCreatedProcess = {
          id: 'process-simple-123',
          name: 'Simple Approval Process',
          description: 'A basic two-state approval process',
          processSchema: simpleProcessSchema,
          createdByProfileId: 'profile-id-123',
          createdAt: new Date().toISOString(),
        };

        mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
        mockDb.insert.mockReturnValueOnce({
          values: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([mockCreatedProcess]),
          }),
        } as any);

        const result = await createProcess({
          data: {
            name: 'Simple Approval Process',
            description: 'A basic two-state approval process',
            processSchema: simpleProcessSchema,
          },
          user: mockUser,
        });

        expect(result.id).toBe('process-simple-123');
        expect(result.processSchema.states).toHaveLength(2);
      });

      it('should create a complex process with all features', async () => {
        const mockCreatedProcess = {
          id: 'process-complex-123',
          name: 'Multi-Stage Review Process',
          processSchema: complexProcessSchema,
          createdByProfileId: 'profile-id-123',
        };

        mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
        mockDb.insert.mockReturnValueOnce({
          values: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([mockCreatedProcess]),
          }),
        } as any);

        const result = await createProcess({
          data: {
            name: 'Multi-Stage Review Process',
            description: complexProcessSchema.description,
            processSchema: complexProcessSchema,
          },
          user: mockUser,
        });

        expect(result.processSchema.budget).toBe(100000);
        expect(result.processSchema.fields).toBeDefined();
        expect(result.processSchema.states).toHaveLength(4);
      });
    });

    describe('updateProcess', () => {
      it('should update process metadata', async () => {
        const mockExistingProcess = {
          id: 'process-123',
          name: 'Old Name',
          description: 'Old description',
          processSchema: simpleProcessSchema,
          createdByProfileId: 'profile-id-123',
        };

        const mockUpdatedProcess = {
          ...mockExistingProcess,
          name: 'Updated Process Name',
          description: 'Updated description',
        };

        mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
        mockDb.query.decisionProcesses.findFirst.mockResolvedValueOnce(
          mockExistingProcess as any,
        );
        mockDb.update.mockReturnValueOnce({
          set: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              returning: vi.fn().mockResolvedValueOnce([mockUpdatedProcess]),
            }),
          }),
        } as any);

        const result = await updateProcess({
          data: {
            id: 'process-123',
            name: 'Updated Process Name',
            description: 'Updated description',
          },
          user: mockUser,
        });

        expect(result.name).toBe('Updated Process Name');
        expect(result.description).toBe('Updated description');
      });

      it('should prevent updating process not owned by user', async () => {
        const mockExistingProcess = {
          id: 'process-123',
          createdByProfileId: 'different-profile-id',
        };

        mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
        mockDb.query.decisionProcesses.findFirst.mockResolvedValueOnce(
          mockExistingProcess as any,
        );

        await expect(
          updateProcess({
            data: {
              id: 'process-123',
              name: 'Unauthorized Update',
            },
            user: mockUser,
          }),
        ).rejects.toThrow(UnauthorizedError);
      });
    });

    describe('listProcesses', () => {
      it('should list processes with pagination', async () => {
        const mockProcesses = [
          { id: 'process-1', name: 'Process 1' },
          { id: 'process-2', name: 'Process 2' },
        ];

        mockDb.query.decisionProcesses.findMany.mockResolvedValueOnce(
          mockProcesses,
        );
        mockDb.select.mockReturnValueOnce({
          from: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockResolvedValueOnce([{ count: 2 }]),
          }),
        } as any);

        const result = await listProcesses({
          limit: 10,
          offset: 0,
        });

        expect(result.processes).toHaveLength(2);
        expect(result.processes[0].id).toBe('process-1');
        expect(result.total).toBe(2);
      });

      it('should filter processes by owner', async () => {
        const mockOwnedProcesses = [
          {
            id: 'process-1',
            name: 'My Process',
            createdByProfileId: 'profile-id-123',
          },
        ];

        mockDb.query.decisionProcesses.findMany.mockResolvedValueOnce(
          mockOwnedProcesses,
        );
        mockDb.select.mockReturnValueOnce({
          from: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockResolvedValueOnce([{ count: 1 }]),
          }),
        } as any);

        const result = await listProcesses({
          createdByProfileId: 'profile-id-123',
        });

        expect(result.processes).toHaveLength(1);
        expect(result.processes[0].createdByProfileId).toBe('profile-id-123');
      });
    });
  });

  describe('Instance Management', () => {
    describe('createInstance', () => {
      it('should create instance with initial state', async () => {
        const mockProcess = {
          id: 'process-123',
          processSchema: simpleProcessSchema,
        };

        const instanceData: InstanceData = {
          currentStateId: 'pending',
          fieldValues: {
            requestor: 'John Doe',
          },
        };

        const mockCreatedInstance = {
          id: 'instance-123',
          processId: 'process-123',
          name: 'Q1 Budget Request',
          instanceData,
          currentStateId: 'pending',
          ownerProfileId: 'profile-id-123',
        };

        mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
        mockDb.query.decisionProcesses.findFirst.mockResolvedValueOnce(
          mockProcess as any,
        );
        mockDb.insert.mockReturnValueOnce({
          values: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([mockCreatedInstance]),
          }),
        } as any);

        const result = await createInstance({
          data: {
            processId: 'process-123',
            name: 'Q1 Budget Request',
            instanceData,
          },
          user: mockUser,
        });

        expect(result.currentStateId).toBe('pending');
        expect(result.instanceData.currentStateId).toBe('pending');
      });

      it('should initialize state data with timestamp', async () => {
        const mockProcess = {
          id: 'process-123',
          processSchema: complexProcessSchema,
        };

        const instanceData: InstanceData = {
          currentStateId: 'draft',
          budget: 50000,
          fieldValues: {
            department: 'engineering',
            priority: 'high',
          },
        };

        const mockCreatedInstance = {
          id: 'instance-456',
          processId: 'process-123',
          instanceData: {
            ...instanceData,
            stateData: {
              draft: {
                enteredAt: new Date().toISOString(),
              },
            },
          },
        };

        mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
        mockDb.query.decisionProcesses.findFirst.mockResolvedValueOnce(
          mockProcess as any,
        );
        mockDb.insert.mockReturnValueOnce({
          values: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([mockCreatedInstance]),
          }),
        } as any);

        const result = await createInstance({
          data: {
            processId: 'process-123',
            name: 'Engineering Priority Request',
            instanceData,
          },
          user: mockUser,
        });

        expect(result.instanceData.stateData?.draft?.enteredAt).toBeDefined();
      });
    });
  });

  describe('Proposal Management', () => {
    describe('createProposal', () => {
      it('should create proposal when allowed in current state', async () => {
        const proposalData: ProposalData = {
          title: 'New Equipment Purchase',
          amount: 5000,
        };

        const mockInstance = {
          id: 'instance-123',
          currentStateId: 'pending',
          instanceData: { currentStateId: 'pending' },
          process: {
            processSchema: simpleProcessSchema,
          },
        };

        const mockCreatedProposal = {
          id: 'proposal-123',
          processInstanceId: 'instance-123',
          proposalData,
          submittedByProfileId: 'profile-id-123',
          status: 'submitted',
        };

        mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
        mockDb.query.processInstances.findFirst.mockResolvedValueOnce(
          mockInstance as any,
        );
        mockDb.insert.mockReturnValueOnce({
          values: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([mockCreatedProposal]),
          }),
        } as any);

        const result = await createProposal({
          data: {
            processInstanceId: 'instance-123',
            proposalData,
          },
          user: mockUser,
        });

        expect(result.id).toBe('proposal-123');
        expect(result.status).toBe('submitted');
      });

      it('should reject proposal in state that disallows proposals', async () => {
        const mockInstance = {
          id: 'instance-123',
          currentStateId: 'approved',
          instanceData: { currentStateId: 'approved' },
          process: {
            processSchema: simpleProcessSchema,
          },
        };

        mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
        mockDb.query.processInstances.findFirst.mockResolvedValueOnce(
          mockInstance as any,
        );

        await expect(
          createProposal({
            data: {
              processInstanceId: 'instance-123',
              proposalData: { title: 'Late Proposal', amount: 1000 },
            },
            user: mockUser,
          }),
        ).rejects.toThrow(ValidationError);
      });
    });

    describe('updateProposal', () => {
      it('should update own proposal', async () => {
        const mockProposal = {
          id: 'proposal-123',
          submittedByProfileId: 'profile-id-123',
          proposalData: { title: 'Original', amount: 1000 },
        };

        const updatedData = { title: 'Updated Title', amount: 1500 };
        const mockUpdatedProposal = {
          ...mockProposal,
          proposalData: updatedData,
          updatedAt: new Date().toISOString(),
        };

        mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
        mockDb.query.proposals.findFirst.mockResolvedValueOnce(
          mockProposal as any,
        );
        mockDb.update.mockReturnValueOnce({
          set: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              returning: vi.fn().mockResolvedValueOnce([mockUpdatedProposal]),
            }),
          }),
        } as any);

        const result = await updateProposal({
          data: {
            id: 'proposal-123',
            proposalData: updatedData,
          },
          user: mockUser,
        });

        expect(result.proposalData.title).toBe('Updated Title');
        expect(result.proposalData.amount).toBe(1500);
      });

      it('should prevent updating other user proposals', async () => {
        const mockProposal = {
          id: 'proposal-123',
          submittedByProfileId: 'different-profile-id',
        };

        mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
        mockDb.query.proposals.findFirst.mockResolvedValueOnce(
          mockProposal as any,
        );

        await expect(
          updateProposal({
            data: {
              id: 'proposal-123',
              proposalData: { title: 'Unauthorized Update' },
            },
            user: mockUser,
          }),
        ).rejects.toThrow(UnauthorizedError);
      });
    });

    describe('listProposals', () => {
      it('should list proposals for instance with filters', async () => {
        const mockProposals = [
          {
            id: 'proposal-1',
            status: 'submitted',
            proposalData: { title: 'Proposal 1' },
            submittedBy: { name: 'User 1' },
          },
          {
            id: 'proposal-2',
            status: 'submitted',
            proposalData: { title: 'Proposal 2' },
            submittedBy: { name: 'User 2' },
          },
        ];

        mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
        mockDb.select.mockReturnValueOnce({
          from: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockResolvedValueOnce([{ count: 2 }]),
          }),
        } as any);
        mockDb.query.proposals.findMany.mockResolvedValueOnce(
          mockProposals as any,
        );

        const result = await listProposals({
          input: {
            processInstanceId: 'instance-123',
            status: 'submitted',
          },
          user: mockUser,
        });

        expect(result.proposals).toHaveLength(2);
        expect(result.proposals[0].status).toBe('submitted');
        expect(result.total).toBe(2);
      });
    });

    describe('deleteProposal', () => {
      it('should delete own proposal in draft status', async () => {
        const mockProposal = {
          id: 'proposal-123',
          submittedByProfileId: 'profile-id-123',
          status: 'draft',
          processInstance: {
            ownerProfileId: 'different-profile-id',
          },
          decisions: [],
        };

        mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
        mockDb.query.proposals.findFirst.mockResolvedValueOnce(
          mockProposal as any,
        );
        mockDb.delete.mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([mockProposal]),
          }),
        } as any);

        const result = await deleteProposal({
          proposalId: 'proposal-123',
          user: mockUser,
        });

        expect(result.success).toBe(true);
        expect(result.deletedId).toBe('proposal-123');
      });
    });
  });

  describe('Transition Management', () => {
    describe('checkTransitions', () => {
      it('should check available transitions with conditions', async () => {
        const mockInstance = {
          id: 'instance-123',
          currentStateId: 'draft',
          instanceData: {
            currentStateId: 'draft',
            stateData: {
              draft: {
                enteredAt: new Date().toISOString(),
              },
            },
          },
          process: {
            processSchema: complexProcessSchema,
          },
        };

        mockDb.query.processInstances.findFirst.mockResolvedValueOnce(
          mockInstance as any,
        );
        mockDb.$count.mockResolvedValueOnce(3); // 3 proposals

        const result = await checkTransitions({
          data: {
            instanceId: 'instance-123',
          },
          user: mockUser,
        });

        expect(result.canTransition).toBe(true);
        expect(result.availableTransitions).toHaveLength(1);
        expect(result.availableTransitions[0].toStateId).toBe('review');
      });

      it('should filter transitions by target state', async () => {
        const mockInstance = {
          id: 'instance-123',
          currentStateId: 'review',
          instanceData: {
            currentStateId: 'review',
          },
          process: {
            processSchema: complexProcessSchema,
          },
        };

        mockDb.query.processInstances.findFirst.mockResolvedValueOnce(
          mockInstance as any,
        );

        const result = await checkTransitions({
          data: {
            instanceId: 'instance-123',
            toStateId: 'approved',
          },
          user: mockUser,
        });

        expect(result.availableTransitions).toHaveLength(1);
        expect(result.availableTransitions[0].toStateId).toBe('approved');
      });
    });

    describe('executeTransition', () => {
      it('should execute transition with actions', async () => {
        const mockInstance = {
          id: 'instance-123',
          currentStateId: 'review',
          instanceData: {
            currentStateId: 'review',
            fieldValues: {
              reviewComplete: true,
            },
          },
          process: {
            processSchema: complexProcessSchema,
          },
        };

        const updatedInstance = {
          ...mockInstance,
          currentStateId: 'approved',
          instanceData: {
            ...mockInstance.instanceData,
            currentStateId: 'approved',
            fieldValues: {
              ...mockInstance.instanceData.fieldValues,
              approvedAt: expect.any(String),
            },
          },
        };

        // Setup mocks for transition check and execution
        mockDb.query.processInstances.findFirst
          .mockResolvedValueOnce(mockInstance as any)
          .mockResolvedValueOnce(mockInstance as any)
          .mockResolvedValueOnce(updatedInstance as any);

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

        const result = await executeTransition({
          data: {
            instanceId: 'instance-123',
            toStateId: 'approved',
          },
          user: mockUser,
        });

        expect(result.currentStateId).toBe('approved');
        expect(mockTrx.update).toHaveBeenCalled();
        expect(mockTrx.insert).toHaveBeenCalled();
      });

      it('should reject invalid transitions', async () => {
        const mockInstance = {
          id: 'instance-123',
          currentStateId: 'draft',
          instanceData: {
            currentStateId: 'draft',
          },
          process: {
            processSchema: complexProcessSchema,
          },
        };

        mockDb.query.processInstances.findFirst.mockResolvedValueOnce(
          mockInstance as any,
        );
        mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
        mockDb.$count.mockResolvedValueOnce(0); // No proposals - condition fails

        await expect(
          executeTransition({
            data: {
              instanceId: 'instance-123',
              toStateId: 'review',
            },
            user: mockUser,
          }),
        ).rejects.toThrow(ValidationError);
      });
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle full lifecycle: create process -> instance -> proposals -> transitions', async () => {
      // Step 1: Create process
      const mockProcess = {
        id: 'lifecycle-process-123',
        processSchema: simpleProcessSchema,
      };

      mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([mockProcess]),
        }),
      } as any);

      const process = await createProcess({
        data: {
          name: 'Lifecycle Test Process',
          processSchema: simpleProcessSchema,
        },
        user: mockUser,
      });

      // Step 2: Create instance
      const mockInstance = {
        id: 'lifecycle-instance-123',
        processId: process.id,
        currentStateId: 'pending',
        instanceData: { currentStateId: 'pending' },
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
          name: 'Lifecycle Test Instance',
          instanceData: { currentStateId: 'pending' },
        },
        user: mockUser,
      });

      // Step 3: Create proposal
      const mockProposal = {
        id: 'lifecycle-proposal-123',
        processInstanceId: instance.id,
        proposalData: { title: 'Test Proposal', amount: 1000 },
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
          proposalData: { title: 'Test Proposal', amount: 1000 },
        },
        user: mockUser,
      });

      // Step 4: Execute transition
      const updatedInstance = {
        ...mockInstance,
        currentStateId: 'approved',
      };

      mockDb.query.processInstances.findFirst
        .mockResolvedValueOnce({ ...mockInstance, process: mockProcess } as any)
        .mockResolvedValueOnce({ ...mockInstance, process: mockProcess } as any)
        .mockResolvedValueOnce(updatedInstance as any);

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

      const finalInstance = await executeTransition({
        data: {
          instanceId: instance.id,
          toStateId: 'approved',
        },
        user: mockUser,
      });

      expect(finalInstance.currentStateId).toBe('approved');
    });

    it('should handle concurrent proposals from multiple users', async () => {
      const mockInstance = {
        id: 'concurrent-instance-123',
        currentStateId: 'pending',
        instanceData: { currentStateId: 'pending' },
        process: {
          processSchema: simpleProcessSchema,
        },
      };

      // User 1 creates proposal
      mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
      mockDb.query.processInstances.findFirst.mockResolvedValueOnce(
        mockInstance as any,
      );
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([
            {
              id: 'proposal-user1',
              submittedByProfileId: 'profile-id-123',
            },
          ]),
        }),
      } as any);

      const proposal1 = await createProposal({
        data: {
          processInstanceId: 'concurrent-instance-123',
          proposalData: { title: 'User 1 Proposal', amount: 1000 },
        },
        user: mockUser,
      });

      // User 2 creates proposal
      mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser2);
      mockDb.query.processInstances.findFirst.mockResolvedValueOnce(
        mockInstance as any,
      );
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([
            {
              id: 'proposal-user2',
              submittedByProfileId: 'profile-id-456',
            },
          ]),
        }),
      } as any);

      const proposal2 = await createProposal({
        data: {
          processInstanceId: 'concurrent-instance-123',
          proposalData: { title: 'User 2 Proposal', amount: 2000 },
        },
        user: mockUser2,
      });

      expect(proposal1.submittedByProfileId).not.toBe(
        proposal2.submittedByProfileId,
      );
    });
  });
});
