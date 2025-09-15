import type { InstanceData, ProcessSchema } from '@op/common';

import { schemaDefaults as horizonDefaults } from '../components/Profile/CreateDecisionProcessModal/schemas/horizon';

// import { schemaDefaults as simpleDefaults } from '../components/Profile/CreateDecisionProcessModal/schemas/simple';

// Type definitions for data transformation
export interface ProcessInstance {
  id: string;
  name: string;
  description?: string | null;
  currentStateId?: string | null;
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
  startDate?: string;
  endDate?: string;
}

type FormPhaseData = {
  proposalSubmissionPhase?: {
    submissionsOpen?: string;
    submissionsClose?: string;
    hideSubmitButton?: boolean;
  };
  communityVotingPhase?: { votingOpen?: string; votingClose?: string };
  committeeDeliberationPhase?: {
    deliberationStart?: string;
    deliberationEnd?: string;
  };
  resultsPhase?: { resultsDate?: string };
};

/**
 * Transforms process instance data from the API into form data structure
 * that can be used in the multi-step form
 */
export const transformInstanceDataToFormData = (
  instance: ProcessInstance,
): Record<string, unknown> => {
  const schemaDefaults = horizonDefaults;

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

  // Extract phase dates if they exist - use dynamic mapping based on current schema defaults
  if (instance.instanceData?.phases) {
    const phases = instance.instanceData.phases;

    // Get the current schema defaults to know what phase structure we're using
    const schemaKeys = Object.keys(schemaDefaults);
    const phaseKeys = schemaKeys.filter(
      (key) =>
        typeof schemaDefaults[key as keyof typeof schemaDefaults] ===
          'object' &&
        schemaDefaults[key as keyof typeof schemaDefaults] !== null &&
        !Array.isArray(schemaDefaults[key as keyof typeof schemaDefaults]),
    );

    // For each phase key in the schema defaults, try to find corresponding phase data
    phaseKeys.forEach((phaseKey) => {
      const schemaPhaseDefaults = schemaDefaults[
        phaseKey as keyof typeof schemaDefaults
      ] as any;
      if (schemaPhaseDefaults && typeof schemaPhaseDefaults === 'object') {
        // Find the matching phase by trying different state ID patterns
        let matchingPhase = null;

        // Try exact match first
        matchingPhase = phases.find(
          (p: PhaseConfiguration) => p.stateId === phaseKey,
        );

        // If no exact match, try common mappings
        if (!matchingPhase) {
          const mappings: Record<string, string[]> = {
            proposalSubmissionPhase: ['proposalSubmission', 'submission'],
            communityVotingPhase: ['communityVoting', 'voting'],
            committeeDeliberationPhase: ['committeeDeliberation', 'review'],
            resultsPhase: ['results'],
            ideaCollectionPhase: ['ideaCollection'],
            reviewShortlistingPhase: ['review'],
            votingPhase: ['voting'],
            resultsAnnouncement: ['results'],
          };

          const possibleStateIds = mappings[phaseKey] || [];
          matchingPhase = phases.find((p: PhaseConfiguration) =>
            possibleStateIds.includes(p.stateId),
          );
        }

        if (matchingPhase) {
          // Reconstruct the phase object based on schema defaults structure
          const phaseObj: any = {};
          Object.keys(schemaPhaseDefaults).forEach((fieldKey) => {
            if (fieldKey.includes('Open') || fieldKey.includes('Start')) {
              phaseObj[fieldKey] = matchingPhase?.startDate || '';
            } else if (fieldKey.includes('Close') || fieldKey.includes('End')) {
              phaseObj[fieldKey] = matchingPhase?.endDate || '';
            } else if (fieldKey === 'resultsDate') {
              // Special case: resultsDate maps to startDate for results phase
              phaseObj[fieldKey] = matchingPhase?.startDate || '';
            } else {
              // Keep the default value for non-date fields
              phaseObj[fieldKey] = schemaPhaseDefaults[fieldKey];
            }
          });

          formData[phaseKey] = phaseObj;
        } else {
          // No matching phase found, use schema defaults
          formData[phaseKey] = schemaPhaseDefaults;
        }
      }
    });
  }

  return formData;
};

/**
 * Transforms form data back into the instance data structure
 * that can be saved to the database
 */
export const transformFormDataToInstanceData = (
  data: Record<string, unknown>,
): InstanceData => {
  return {
    budget: data.totalBudget as number,
    hideBudget: data.hideBudget as boolean,
    currentStateId: 'proposalSubmission',
    fieldValues: {
      categories: data.categories,
      budgetCapAmount: data.budgetCapAmount,
      descriptionGuidance: data.descriptionGuidance,
      maxVotesPerMember: data.maxVotesPerMember,
      proposalInfoTitle: data.proposalInfoTitle,
      proposalInfoContent: data.proposalInfoContent,
    },
    phases: [
      {
        stateId: 'proposalSubmission',
        startDate: (
          data.proposalSubmissionPhase as {
            submissionsOpen?: string;
            submissionsClose?: string;
          }
        )?.submissionsOpen,
        endDate: (
          data.proposalSubmissionPhase as {
            submissionsOpen?: string;
            submissionsClose?: string;
          }
        )?.submissionsClose,
      },
      {
        stateId: 'communityVoting',
        startDate: (
          data.communityVotingPhase as {
            votingOpen?: string;
            votingClose?: string;
          }
        )?.votingOpen,
        endDate: (
          data.communityVotingPhase as {
            votingOpen?: string;
            votingClose?: string;
          }
        )?.votingClose,
      },
      {
        stateId: 'committeeDeliberation',
        startDate: (
          data.committeeDeliberationPhase as {
            deliberationStart?: string;
            deliberationEnd?: string;
          }
        )?.deliberationStart,
        endDate: (
          data.committeeDeliberationPhase as {
            deliberationStart?: string;
            deliberationEnd?: string;
          }
        )?.deliberationEnd,
      },
      {
        stateId: 'results',
        startDate: (data.resultsPhase as { resultsDate?: string })?.resultsDate,
      },
    ],
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
  const proposalPhase = phases.proposalSubmissionPhase || {};
  const communityVotingPhase = phases.communityVotingPhase || {};
  const committeeDeliberationPhase = phases.committeeDeliberationPhase || {};
  const resultsPhase = phases.resultsPhase || {};

  const submissionOpen = proposalPhase.submissionsOpen;
  const submissionClose = proposalPhase.submissionsClose;
  const votingOpen = communityVotingPhase.votingOpen;
  const votingClose = communityVotingPhase.votingClose;
  const deliberationStart = committeeDeliberationPhase.deliberationStart;
  const deliberationEnd = committeeDeliberationPhase.deliberationEnd;
  const resultsDate = resultsPhase.resultsDate;

  const dates = [
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
    { name: 'Voting Open', value: votingOpen, key: 'votingOpen' },
    { name: 'Voting Close', value: votingClose, key: 'votingClose' },
    {
      name: 'Deliberation Start',
      value: deliberationStart,
      key: 'deliberationStart',
    },
    {
      name: 'Deliberation End',
      value: deliberationEnd,
      key: 'deliberationEnd',
    },
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
