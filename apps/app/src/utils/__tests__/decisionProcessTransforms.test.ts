import { describe, expect, it } from 'vitest';
import {
  transformInstanceDataToFormData,
  transformFormDataToInstanceData,
  type ProcessInstance,
} from '../decisionProcessTransforms';

// Mock process instance data for testing
const mockHorizonInstance: ProcessInstance = {
  id: 'test-instance-1',
  name: 'Test Horizon Process',
  description: 'Test horizon process description',
  currentStateId: 'proposalSubmission',
  instanceData: {
    budget: 50000,
    hideBudget: false,
    currentStateId: 'proposalSubmission',
    fieldValues: {
      categories: ['infrastructure', 'education'],
      budgetCapAmount: 10000,
      descriptionGuidance: 'Please provide detailed information...',
      maxVotesPerMember: 3,
      proposalInfoTitle: 'Proposal Guidelines',
      proposalInfoContent: 'Follow these guidelines...',
    },
    phases: [
      {
        stateId: 'proposalSubmission',
        plannedStartDate: '2024-01-01',
        plannedEndDate: '2024-01-31',
      },
      {
        stateId: 'communityVoting',
        plannedStartDate: '2024-02-01',
        plannedEndDate: '2024-02-15',
      },
      {
        stateId: 'committeeDeliberation',
        plannedStartDate: '2024-02-16',
        plannedEndDate: '2024-02-28',
      },
      {
        stateId: 'results',
        plannedStartDate: '2024-03-01',
      },
    ],
  },
  status: 'active',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockSimpleInstance: ProcessInstance = {
  id: 'test-instance-2',
  name: 'Test Simple Process',
  description: 'Test simple process description',
  currentStateId: 'ideaCollection',
  instanceData: {
    budget: 25000,
    hideBudget: true,
    currentStateId: 'ideaCollection',
    fieldValues: {
      categories: ['general'],
      budgetCapAmount: 5000,
      descriptionGuidance: 'Keep it simple...',
      maxVotesPerMember: 5,
      proposalInfoTitle: 'Simple Guidelines',
      proposalInfoContent: 'Simple process...',
    },
    phases: [
      {
        stateId: 'ideaCollection',
        plannedStartDate: '2024-01-01',
        plannedEndDate: '2024-01-15',
      },
      {
        stateId: 'submission',
        plannedStartDate: '2024-01-16',
        plannedEndDate: '2024-01-31',
      },
      {
        stateId: 'review',
        plannedStartDate: '2024-02-01',
        plannedEndDate: '2024-02-10',
      },
      {
        stateId: 'voting',
        plannedStartDate: '2024-02-11',
        plannedEndDate: '2024-02-20',
      },
      {
        stateId: 'results',
        plannedStartDate: '2024-02-21',
      },
    ],
  },
  status: 'active',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('Decision Process Transforms', () => {
  describe('transformInstanceDataToFormData', () => {
    it('should transform horizon schema instance data correctly', () => {
      const formData = transformInstanceDataToFormData(mockHorizonInstance, 'horizon');

      expect(formData.processName).toBe('Test Horizon Process');
      expect(formData.description).toBe('Test horizon process description');
      expect(formData.totalBudget).toBe(50000);
      expect(formData.hideBudget).toBe(false);
      expect(formData.categories).toEqual(['infrastructure', 'education']);
      expect(formData.budgetCapAmount).toBe(10000);
      expect(formData.maxVotesPerMember).toBe(3);

      // Check horizon-specific phase structure
      expect(formData.proposalSubmissionPhase).toEqual({
        submissionsOpen: '2024-01-01',
        submissionsClose: '2024-01-31',
        hideSubmitButton: false,
      });
      expect(formData.communityVotingPhase).toEqual({
        votingOpen: '2024-02-01',
        votingClose: '2024-02-15',
      });
      expect(formData.committeeDeliberationPhase).toEqual({
        deliberationStart: '2024-02-16',
        deliberationEnd: '2024-02-28',
      });
      expect(formData.resultsPhase).toEqual({
        resultsDate: '2024-03-01',
      });
    });

    it('should transform simple schema instance data correctly', () => {
      const formData = transformInstanceDataToFormData(mockSimpleInstance, 'simple');

      expect(formData.processName).toBe('Test Simple Process');
      expect(formData.description).toBe('Test simple process description');
      expect(formData.totalBudget).toBe(25000);
      expect(formData.hideBudget).toBe(true);
      expect(formData.categories).toEqual(['general']);
      expect(formData.budgetCapAmount).toBe(5000);
      expect(formData.maxVotesPerMember).toBe(5);

      // Check simple-specific phase structure
      expect(formData.ideaCollectionPhase).toEqual({
        ideaCollectionOpen: '2024-01-01',
        ideaCollectionClose: '2024-01-15',
      });
      expect(formData.proposalSubmissionPhase).toEqual({
        submissionsOpen: '2024-01-16',
        submissionsClose: '2024-01-31',
      });
      expect(formData.reviewShortlistingPhase).toEqual({
        reviewOpen: '2024-02-01',
        reviewClose: '2024-02-10',
      });
      expect(formData.votingPhase).toEqual({
        votingOpen: '2024-02-11',
        votingClose: '2024-02-20',
      });
      expect(formData.resultsAnnouncement).toEqual({
        resultsDate: '2024-02-21',
      });
    });

    it('should default to horizon schema when no schema type provided', () => {
      const formData = transformInstanceDataToFormData(mockHorizonInstance);
      
      // Should use horizon schema defaults and phase structure
      expect(formData.proposalSubmissionPhase).toBeDefined();
      expect(formData.communityVotingPhase).toBeDefined();
      expect(formData.committeeDeliberationPhase).toBeDefined();
      expect(formData.resultsPhase).toBeDefined();
      
      // Should not have simple schema phases
      expect(formData.ideaCollectionPhase).toBeUndefined();
      expect(formData.reviewShortlistingPhase).toBeUndefined();
      expect(formData.votingPhase).toBeUndefined();
      expect(formData.resultsAnnouncement).toBeUndefined();
    });

    it('should handle missing phase data gracefully', () => {
      const instanceWithoutPhases = {
        ...mockHorizonInstance,
        instanceData: {
          ...mockHorizonInstance.instanceData!,
          phases: undefined,
        },
      };

      const formData = transformInstanceDataToFormData(instanceWithoutPhases, 'horizon');
      
      expect(formData.processName).toBe('Test Horizon Process');
      expect(formData.totalBudget).toBe(50000);
      
      // Should use schema defaults for phases when none exist
      expect(formData.proposalSubmissionPhase).toBeDefined();
      expect(formData.communityVotingPhase).toBeDefined();
    });
  });

  describe('transformFormDataToInstanceData', () => {
    it('should transform form data to instance data correctly', () => {
      const formData = {
        processName: 'Test Process',
        description: 'Test description',
        totalBudget: 30000,
        hideBudget: false,
        categories: ['category1', 'category2'],
        budgetCapAmount: 8000,
        descriptionGuidance: 'Test guidance',
        maxVotesPerMember: 4,
        proposalInfoTitle: 'Test Title',
        proposalInfoContent: 'Test Content',
        proposalSubmissionPhase: {
          submissionsOpen: '2024-01-01',
          submissionsClose: '2024-01-31',
        },
        communityVotingPhase: {
          votingOpen: '2024-02-01',
          votingClose: '2024-02-15',
        },
        committeeDeliberationPhase: {
          deliberationStart: '2024-02-16',
          deliberationEnd: '2024-02-28',
        },
        resultsPhase: {
          resultsDate: '2024-03-01',
        },
      };

      const instanceData = transformFormDataToInstanceData(formData);

      expect(instanceData.budget).toBe(30000);
      expect(instanceData.hideBudget).toBe(false);
      expect(instanceData.currentStateId).toBe('proposalSubmission');
      expect(instanceData.fieldValues).toEqual({
        categories: ['category1', 'category2'],
        budgetCapAmount: 8000,
        descriptionGuidance: 'Test guidance',
        maxVotesPerMember: 4,
        proposalInfoTitle: 'Test Title',
        proposalInfoContent: 'Test Content',
      });

      expect(instanceData.phases).toHaveLength(4);
      expect(instanceData.phases![0]).toEqual({
        stateId: 'proposalSubmission',
        plannedStartDate: '2024-01-01',
        plannedEndDate: '2024-01-31',
      });
      expect(instanceData.phases![3]).toEqual({
        stateId: 'results',
        plannedStartDate: '2024-03-01',
      });
    });

    it('should handle missing phase data in form', () => {
      const formData = {
        processName: 'Test Process',
        totalBudget: 30000,
        hideBudget: false,
        categories: [],
        budgetCapAmount: 5000,
        maxVotesPerMember: 3,
      };

      const instanceData = transformFormDataToInstanceData(formData);

      expect(instanceData.budget).toBe(30000);
      expect(instanceData.phases).toHaveLength(4);
      
      // Should handle undefined phase data gracefully
      expect(instanceData.phases![0].stateId).toBe('proposalSubmission');
      expect(instanceData.phases![0].plannedStartDate).toBeUndefined();
    });
  });
});