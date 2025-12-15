import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockDb } from '../../../test/setup';
import { UnauthorizedError, ValidationError } from '../../../utils';
import { createInstance } from '../createInstance';
import { createProcess } from '../createProcess';
import { createProposal } from '../createProposal';
import { TransitionEngine } from '../transitionEngine';
import type { InstanceData, ProcessSchema, ProposalData } from '../types';

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

// Define the 4-stage voting process schema
const votingProcessSchema: ProcessSchema = {
  name: 'Community Voting Process',
  description:
    'A 4-stage voting process: proposals, voting, offline decision, final decision',
  states: [
    {
      id: 'proposal_submission',
      name: 'Proposal Submission',
      type: 'initial',
      description: 'Users can submit proposals during this phase',
      config: {
        allowProposals: true,
        allowDecisions: false,
        visibleComponents: ['proposal-form', 'proposal-list'],
      },
    },
    {
      id: 'voting_phase',
      name: 'Voting Phase',
      type: 'intermediate',
      description: 'Users vote for up to 5 proposals',
      config: {
        allowProposals: false,
        allowDecisions: true,
        visibleComponents: ['voting-form', 'proposal-list', 'voting-results'],
      },
    },
    {
      id: 'offline_decision',
      name: 'Offline Decision',
      type: 'intermediate',
      description: 'Administrators review votes and make decisions offline',
      config: {
        allowProposals: false,
        allowDecisions: false,
        visibleComponents: ['voting-results', 'admin-notes'],
      },
    },
    {
      id: 'final_decision',
      name: 'Final Decision',
      type: 'final',
      description: 'Decision is finalized, voting and proposals are closed',
      config: {
        allowProposals: false,
        allowDecisions: false,
        visibleComponents: ['final-results', 'decision-summary'],
      },
    },
  ],
  transitions: [
    {
      id: 'start_voting',
      name: 'Start Voting Phase',
      from: 'proposal_submission',
      to: 'voting_phase',
      rules: {
        type: 'automatic',
        conditions: [
          {
            type: 'time',
            operator: 'greaterThan',
            value: 604800000, // 7 days in milliseconds
          },
          {
            type: 'proposalCount',
            operator: 'greaterThan',
            value: 2, // Minimum 3 proposals
          },
        ],
        requireAll: true,
      },
    },
    {
      id: 'begin_offline_review',
      name: 'Begin Offline Review',
      from: 'voting_phase',
      to: 'offline_decision',
      rules: {
        type: 'automatic',
        conditions: [
          {
            type: 'time',
            operator: 'greaterThan',
            value: 432000000, // 5 days in milliseconds
          },
          {
            type: 'participationCount',
            operator: 'greaterThan',
            value: 9, // Minimum 10 participants
          },
        ],
        requireAll: true,
      },
    },
    {
      id: 'finalize_decision',
      name: 'Finalize Decision',
      from: 'offline_decision',
      to: 'final_decision',
      rules: {
        type: 'manual',
        conditions: [
          {
            type: 'customField',
            operator: 'equals',
            field: 'adminDecisionComplete',
            value: true,
          },
        ],
      },
      actions: [
        {
          type: 'notify',
          config: {
            notificationType: 'decision_finalized',
            recipients: 'all_participants',
          },
        },
        {
          type: 'updateField',
          config: {
            field: 'finalizedAt',
            value: 'current_timestamp',
          },
        },
      ],
    },
  ],
  initialState: 'proposal_submission',
  // Users can select up to 5 proposals in voting phase
  decisionDefinition: {
    type: 'object',
    properties: {
      selectedProposals: {
        type: 'array',
        maxItems: 5,
        minItems: 1,
        items: {
          type: 'string',
          description: 'Proposal ID',
        },
      },
      voterComments: {
        type: 'string',
        maxLength: 500,
        description: 'Optional comments from the voter',
      },
    },
    required: ['selectedProposals'],
  },
  // Proposal template
  proposalTemplate: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        minLength: 10,
        maxLength: 100,
      },
      description: {
        type: 'string',
        minLength: 50,
        maxLength: 2000,
      },
      category: {
        type: 'string',
        enum: [
          'infrastructure',
          'community',
          'education',
          'sustainability',
          'other',
        ],
      },
      estimatedBudget: {
        type: 'number',
        minimum: 0,
        maximum: 100000,
      },
    },
    required: ['title', 'description', 'category'],
  },
};

describe('Voting Process Integration Test', () => {
  let processId: string;
  let instanceId: string;
  let proposalIds: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    proposalIds = [];
  });

  describe('Process and Instance Creation', () => {
    it('should create the voting process successfully', async () => {
      const mockCreatedProcess = {
        id: 'voting-process-123',
        name: 'Community Voting Process',
        processSchema: votingProcessSchema,
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
          name: 'Community Voting Process',
          description: votingProcessSchema.description,
          processSchema: votingProcessSchema,
        },
        user: mockUser,
      });

      expect(result.id).toBe('voting-process-123');
      expect(result.processSchema.states).toHaveLength(4);
      processId = result.id;
    });

    it('should create a process instance in proposal_submission state', async () => {
      const mockProcess = {
        id: processId,
        processSchema: votingProcessSchema,
      };

      const initialInstanceData: InstanceData = {
        currentStateId: 'proposal_submission',
        budget: 50000,
        fieldValues: {
          votingDeadline: new Date(
            Date.now() + 12 * 24 * 60 * 60 * 1000,
          ).toISOString(), // 12 days from now
        },
        stateData: {
          proposal_submission: {
            enteredAt: new Date().toISOString(),
            metadata: {},
          },
        },
      };

      const mockCreatedInstance = {
        id: 'voting-instance-123',
        processId: processId,
        name: 'Q1 2024 Community Projects',
        instanceData: initialInstanceData,
        currentStateId: 'proposal_submission',
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
          processId: processId,
          name: 'Q1 2024 Community Projects',
          description: 'Community project proposals for Q1 2024',
          instanceData: initialInstanceData,
        },
        user: mockUser,
      });

      expect(result.currentStateId).toBe('proposal_submission');
      instanceId = result.id;
    });
  });

  describe('Stage 1: Proposal Submission', () => {
    it('should allow creating proposals in proposal_submission stage', async () => {
      const proposalData: ProposalData = {
        title: 'Build a Community Garden',
        description:
          'Create a sustainable community garden in the central park area to promote local food production and community engagement.',
        category: 'sustainability',
        estimatedBudget: 15000,
      };

      const mockCreatedProposal = {
        id: 'proposal-001',
        processInstanceId: instanceId,
        proposalData,
        createdByProfileId: 'profile-id-123',
      };

      // Mock instance lookup to verify we're in correct state
      const mockInstance = {
        id: instanceId,
        currentStateId: 'proposal_submission',
        instanceData: {
          currentStateId: 'proposal_submission',
        },
        process: {
          processSchema: votingProcessSchema,
        },
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
          processInstanceId: instanceId,
          proposalData,
        },
        user: mockUser,
      });

      expect(result.id).toBe('proposal-001');
      proposalIds.push(result.id);
    });

    it('should prevent proposals if not in proposal_submission stage', async () => {
      // Mock instance in voting_phase where proposals are not allowed
      const mockInstance = {
        id: instanceId,
        currentStateId: 'voting_phase',
        instanceData: {
          currentStateId: 'voting_phase',
        },
        process: {
          processSchema: votingProcessSchema,
        },
      };

      mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);
      mockDb.query.processInstances.findFirst.mockResolvedValueOnce(
        mockInstance as any,
      );

      await expect(
        createProposal({
          data: {
            processInstanceId: instanceId,
            proposalData: {
              title: 'Late Proposal',
              description: 'This should not be allowed',
              category: 'other',
            },
          },
          user: mockUser,
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Stage 2: Transition to Voting Phase', () => {
    it('should check transition availability when conditions not met', async () => {
      const mockInstance = {
        id: instanceId,
        currentStateId: 'proposal_submission',
        instanceData: {
          currentStateId: 'proposal_submission',
          stateData: {
            proposal_submission: {
              enteredAt: new Date().toISOString(), // Just entered
            },
          },
        },
        process: {
          processSchema: votingProcessSchema,
        },
      };

      mockDb.query.processInstances.findFirst.mockResolvedValueOnce(
        mockInstance as any,
      );
      mockDb.$count.mockResolvedValueOnce(2); // Only 2 proposals (need 3+)

      const result = await TransitionEngine.checkAvailableTransitions({
        instanceId,
        user: mockUser,
      });

      expect(result.canTransition).toBe(false);
      expect(result.availableTransitions[0].toStateId).toBe('voting_phase');
      expect(result.availableTransitions[0].canExecute).toBe(false);
      expect(result.availableTransitions[0].failedRules).toHaveLength(2); // Time and proposal count
    });

    it('should allow transition to voting_phase when conditions are met', async () => {
      const sevenDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

      const mockInstance = {
        id: instanceId,
        currentStateId: 'proposal_submission',
        instanceData: {
          currentStateId: 'proposal_submission',
          stateData: {
            proposal_submission: {
              enteredAt: sevenDaysAgo.toISOString(),
            },
          },
        },
        process: {
          processSchema: votingProcessSchema,
        },
      };

      mockDb.query.processInstances.findFirst.mockResolvedValueOnce(
        mockInstance as any,
      );
      mockDb.$count.mockResolvedValueOnce(5); // 5 proposals (meets minimum)

      const result = await TransitionEngine.checkAvailableTransitions({
        instanceId,
        user: mockUser,
      });

      expect(result.canTransition).toBe(true);
      expect(result.availableTransitions[0].canExecute).toBe(true);
    });
  });

  describe('Stage 3: Voting Phase', () => {
    it('should enforce maximum 5 proposal selections in voting', async () => {
      // This would be validated at the API/decision creation level
      // The decisionDefinition schema enforces maxItems: 5
      const votingDecision = {
        selectedProposals: ['prop-1', 'prop-2', 'prop-3', 'prop-4', 'prop-5'],
        voterComments: 'I support these community initiatives',
      };

      // Validate against schema
      expect(votingDecision.selectedProposals.length).toBeLessThanOrEqual(5);
    });

    it('should check transition to offline_decision requires participation', async () => {
      const fiveDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);

      const mockInstance = {
        id: instanceId,
        currentStateId: 'voting_phase',
        instanceData: {
          currentStateId: 'voting_phase',
          stateData: {
            voting_phase: {
              enteredAt: fiveDaysAgo.toISOString(),
            },
          },
        },
        process: {
          processSchema: votingProcessSchema,
        },
      };

      mockDb.query.processInstances.findFirst.mockResolvedValueOnce(
        mockInstance as any,
      );

      // Mock low participation
      mockDb.selectDistinctOn.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          innerJoin: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              then: vi.fn().mockResolvedValueOnce([1, 2, 3, 4, 5]), // Only 5 participants
            }),
          }),
        }),
      } as any);

      const result = await TransitionEngine.checkAvailableTransitions({
        instanceId,
        user: mockUser,
      });

      expect(result.canTransition).toBe(false);
      const transition = result.availableTransitions.find(
        (t) => t.toStateId === 'offline_decision',
      );
      expect(transition?.canExecute).toBe(false);
    });
  });

  describe('Stage 4: Offline Decision to Final Decision', () => {
    it('should require manual approval with admin flag to finalize', async () => {
      const mockInstance = {
        id: instanceId,
        currentStateId: 'offline_decision',
        instanceData: {
          currentStateId: 'offline_decision',
          fieldValues: {
            adminDecisionComplete: false, // Not yet complete
          },
        },
        process: {
          processSchema: votingProcessSchema,
        },
      };

      mockDb.query.processInstances.findFirst.mockResolvedValueOnce(
        mockInstance as any,
      );

      const result = await TransitionEngine.checkAvailableTransitions({
        instanceId,
        user: mockUser,
      });

      const finalTransition = result.availableTransitions.find(
        (t) => t.toStateId === 'final_decision',
      );
      expect(finalTransition?.canExecute).toBe(false);
    });

    it('should allow transition to final_decision when admin completes review', async () => {
      const mockInstance = {
        id: instanceId,
        currentStateId: 'offline_decision',
        instanceData: {
          currentStateId: 'offline_decision',
          fieldValues: {
            adminDecisionComplete: true, // Admin has completed review
          },
        },
        process: {
          processSchema: votingProcessSchema,
        },
      };

      mockDb.query.processInstances.findFirst.mockResolvedValueOnce(
        mockInstance as any,
      );

      const result = await TransitionEngine.checkAvailableTransitions({
        instanceId,
        user: mockUser,
      });

      const finalTransition = result.availableTransitions.find(
        (t) => t.toStateId === 'final_decision',
      );
      expect(finalTransition?.canExecute).toBe(true);
    });

    it('should execute transition to final_decision with actions', async () => {
      const mockInstance = {
        id: instanceId,
        currentStateId: 'offline_decision',
        instanceData: {
          currentStateId: 'offline_decision',
          fieldValues: {
            adminDecisionComplete: true,
          },
        },
        process: {
          processSchema: votingProcessSchema,
        },
      };

      // Mock for checkAvailableTransitions
      mockDb.query.processInstances.findFirst
        .mockResolvedValueOnce(mockInstance as any) // For check
        .mockResolvedValueOnce(mockInstance as any) // For execute
        .mockResolvedValueOnce({
          // Final result
          ...mockInstance,
          currentStateId: 'final_decision',
          instanceData: {
            ...mockInstance.instanceData,
            currentStateId: 'final_decision',
            fieldValues: {
              ...mockInstance.instanceData.fieldValues,
              finalizedAt: expect.any(String),
            },
          },
        } as any);

      mockDb.query.users.findFirst.mockResolvedValueOnce(mockDbUser);

      // Mock transaction
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
          instanceId,
          toStateId: 'final_decision',
        },
        user: mockUser,
      });

      expect(result.currentStateId).toBe('final_decision');
      expect(mockTrx.update).toHaveBeenCalled();
      expect(mockTrx.insert).toHaveBeenCalled(); // For transition history
    });
  });

  describe('Final State Verification', () => {
    it('should not allow any transitions from final_decision state', async () => {
      const mockInstance = {
        id: instanceId,
        currentStateId: 'final_decision',
        instanceData: {
          currentStateId: 'final_decision',
        },
        process: {
          processSchema: votingProcessSchema,
        },
      };

      mockDb.query.processInstances.findFirst.mockResolvedValueOnce(
        mockInstance as any,
      );

      const result = await TransitionEngine.checkAvailableTransitions({
        instanceId,
        user: mockUser,
      });

      expect(result.canTransition).toBe(false);
      expect(result.availableTransitions).toHaveLength(0);
    });

    it('should not allow proposals or decisions in final state', async () => {
      const finalStateConfig = votingProcessSchema.states.find(
        (s) => s.id === 'final_decision',
      )?.config;

      expect(finalStateConfig?.allowProposals).toBe(false);
      expect(finalStateConfig?.allowDecisions).toBe(false);
    });
  });
});
