import type { InstanceData, ProcessSchema } from '@op/common';

import type { SchemaType } from '../components/Profile/CreateDecisionProcessModal/schemas/schemaLoader';

// Type definitions for data transformation
export interface ProcessInstance {
  id: string;
  name: string;
  description?: string | null;
  instanceData?: InstanceData;
  process?: {
    id: string;
    name: string;
    description?: string | null;
    processSchema: ProcessSchema;
    createdAt?: string | null;
    updatedAt?: string | null;
  };
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface PhaseConfiguration {
  stateId: string;
  actualStartDate?: string;
  actualEndDate?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
}

interface PhaseFormData {
  submissionsOpen?: string;
  submissionsClose?: string;
  allowProposals?: boolean;
}

interface FormPhaseData {
  ideaCollectionPhase?: {
    ideaCollectionOpen?: string;
    ideaCollectionClose?: string;
  };
  proposalSubmissionPhase?: PhaseFormData;
  reviewShortlistingPhase?: { reviewOpen?: string; reviewClose?: string };
  votingPhase?: { votingOpen?: string; votingClose?: string };
  resultsAnnouncement?: { resultsDate?: string };
}

/**
 * Transforms process instance data from the API into form data structure
 * that can be used in the multi-step form
 */
export const transformInstanceDataToFormData = (
  instance: ProcessInstance,
  schemaDefaults: Record<string, unknown>,
): Record<string, unknown> => {
  const formData: Record<string, unknown> = {
    ...schemaDefaults,
    processName: instance.name,
    description: instance.description || '',
    totalBudget: instance.instanceData?.budget || 0,
    hideBudget: instance.instanceData?.hideBudget || false,
    categories: instance.instanceData?.fieldValues?.categories || [],
    budgetCapAmount: instance.instanceData?.fieldValues?.budgetCapAmount || 0,
    descriptionGuidance:
      instance.instanceData?.fieldValues?.descriptionGuidance || '',
    maxVotesPerMember:
      instance.instanceData?.fieldValues?.maxVotesPerMember || 3,
    proposalInfoTitle:
      instance.instanceData?.fieldValues?.proposalInfoTitle || '',
    proposalInfoContent:
      instance.instanceData?.fieldValues?.proposalInfoContent || '',
  };

  // Extract phase dates if they exist
  if (instance.instanceData?.phases) {
    const phases = instance.instanceData.phases;
    const ideaCollectionPhase = phases.find(
      (p: PhaseConfiguration) => p.stateId === 'ideaCollection',
    );
    const submissionPhase = phases.find(
      (p: PhaseConfiguration) => p.stateId === 'submission',
    );
    const reviewPhase = phases.find(
      (p: PhaseConfiguration) => p.stateId === 'review',
    );
    const votingPhase = phases.find(
      (p: PhaseConfiguration) => p.stateId === 'voting',
    );
    const resultsPhase = phases.find(
      (p: PhaseConfiguration) => p.stateId === 'results',
    );

    // Always populate phase objects, even if empty, to match schema defaults
    formData.ideaCollectionPhase = {
      ideaCollectionOpen: ideaCollectionPhase?.plannedStartDate || '',
      ideaCollectionClose: ideaCollectionPhase?.plannedEndDate || '',
    };
    formData.proposalSubmissionPhase = {
      submissionsOpen: submissionPhase?.plannedStartDate || '',
      submissionsClose: submissionPhase?.plannedEndDate || '',
    };
    formData.reviewShortlistingPhase = {
      reviewOpen: reviewPhase?.plannedStartDate || '',
      reviewClose: reviewPhase?.plannedEndDate || '',
    };
    formData.votingPhase = {
      votingOpen: votingPhase?.plannedStartDate || '',
      votingClose: votingPhase?.plannedEndDate || '',
    };
    formData.resultsAnnouncement = {
      resultsDate: resultsPhase?.plannedStartDate || '',
    };
  }

  return formData;
};

/**
 * Transforms form data back into the instance data structure
 * that can be saved to the database
 */
export const transformFormDataToInstanceData = (
  data: Record<string, unknown>,
  schemaType: SchemaType,
): InstanceData => {
  const phases = [];

  // Only add ideaCollection phase for simple and cowop schemas
  if (schemaType === 'simple' || schemaType === 'cowop') {
    phases.push({
      stateId: 'ideaCollection',
      plannedStartDate: (
        data.ideaCollectionPhase as {
          ideaCollectionOpen?: string;
          ideaCollectionClose?: string;
        }
      )?.ideaCollectionOpen,
      plannedEndDate: (
        data.ideaCollectionPhase as {
          ideaCollectionOpen?: string;
          ideaCollectionClose?: string;
        }
      )?.ideaCollectionClose,
    });
  }

  phases.push(
    {
      stateId: 'submission',
      plannedStartDate: (data.proposalSubmissionPhase as PhaseFormData)
        ?.submissionsOpen,
      plannedEndDate: (data.proposalSubmissionPhase as PhaseFormData)
        ?.submissionsClose,
    },
    {
      stateId: 'review',
      plannedStartDate: (
        data.reviewShortlistingPhase as {
          reviewOpen?: string;
          reviewClose?: string;
        }
      )?.reviewOpen,
      plannedEndDate: (
        data.reviewShortlistingPhase as {
          reviewOpen?: string;
          reviewClose?: string;
        }
      )?.reviewClose,
    },
    {
      stateId: 'voting',
      plannedStartDate: (
        data.votingPhase as { votingOpen?: string; votingClose?: string }
      )?.votingOpen,
      plannedEndDate: (
        data.votingPhase as { votingOpen?: string; votingClose?: string }
      )?.votingClose,
    },
    {
      stateId: 'results',
      plannedStartDate: (data.resultsAnnouncement as { resultsDate?: string })
        ?.resultsDate,
    },
  );

  return {
    budget: data.totalBudget as number,
    hideBudget: data.hideBudget as boolean,
    currentStateId: schemaType === 'horizon' ? 'submission' : 'ideaCollection',
    fieldValues: {
      categories: data.categories,
      budgetCapAmount: data.budgetCapAmount,
      descriptionGuidance: data.descriptionGuidance,
      maxVotesPerMember: data.maxVotesPerMember,
      proposalInfoTitle: data.proposalInfoTitle,
      proposalInfoContent: data.proposalInfoContent,
    },
    phases,
  };
};

/**
 * Validates that phase dates are in chronological order
 */
export const validatePhaseSequence = (
  formData: Record<string, unknown>,
): string[] => {
  const errors: string[] = [];

  const phases = formData as FormPhaseData;
  const ideaCollectionPhase = phases.ideaCollectionPhase || {};
  const proposalPhase = phases.proposalSubmissionPhase || {};
  const reviewPhase = phases.reviewShortlistingPhase || {};
  const votingPhase = phases.votingPhase || {};
  const resultsPhase = phases.resultsAnnouncement || {};

  const ideaCollectionOpen = ideaCollectionPhase.ideaCollectionOpen;
  const ideaCollectionClose = ideaCollectionPhase.ideaCollectionClose;
  const submissionOpen = proposalPhase.submissionsOpen;
  const submissionClose = proposalPhase.submissionsClose;
  const reviewOpen = reviewPhase.reviewOpen;
  const reviewClose = reviewPhase.reviewClose;
  const votingOpen = votingPhase.votingOpen;
  const votingClose = votingPhase.votingClose;
  const resultsDate = resultsPhase.resultsDate;

  const dates = [
    {
      name: 'Idea Collection Open',
      value: ideaCollectionOpen,
      key: 'ideaCollectionOpen',
    },
    {
      name: 'Idea Collection Close',
      value: ideaCollectionClose,
      key: 'ideaCollectionClose',
    },
    {
      name: 'Submissions Open',
      value: submissionOpen,
      key: 'submissionsOpen',
    },
    {
      name: 'Submissions Close',
      value: submissionClose,
      key: 'submissionsClose',
    },
    { name: 'Review Open', value: reviewOpen, key: 'reviewOpen' },
    { name: 'Review Close', value: reviewClose, key: 'reviewClose' },
    { name: 'Voting Open', value: votingOpen, key: 'votingOpen' },
    { name: 'Voting Close', value: votingClose, key: 'votingClose' },
    { name: 'Results Date', value: resultsDate, key: 'resultsDate' },
  ].filter((d) => d.value); // Only validate dates that are set

  // Check chronological order
  for (let i = 0; i < dates.length - 1; i++) {
    const currentDate = dates[i];
    const nextDate = dates[i + 1];

    if (currentDate && nextDate && currentDate.value && nextDate.value) {
      const current = new Date(currentDate.value);
      const next = new Date(nextDate.value);

      if (current >= next) {
        errors.push(`${currentDate.name} must be before ${nextDate.name}`);
      }
    }
  }

  return errors;
};
