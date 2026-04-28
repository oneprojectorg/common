import { and, db, eq } from '@op/db/client';
import {
  type VoteData,
  decisionsVoteProposals,
  decisionsVoteSubmissions,
  processInstances,
  proposals,
} from '@op/db/schema';
import { assertAccess, permission } from 'access-zones';

import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils';
import {
  assertInstanceProfileAccess,
  getIndividualProfileId,
  getProfileAccessUser,
} from '../access';
import { decisionPermission } from './permissions';
import { processDecisionProcessSchema } from './schemaRegistry';
import { validateVoteSelection } from './schemaValidators';
import type { DecisionInstanceData } from './schemas/instanceData';
import type { VoteCap } from './schemas/types';
import { isVotingEligible } from './votingEligibility';

interface PhaseConfig {
  allowProposals: boolean;
  allowDecisions: boolean;
  maxVotesPerMember: VoteCap;
}

/** Extract voting/proposal rules for the current phase. */
function getCurrentPhaseConfig(processInstance: {
  instanceData: unknown;
  currentStateId: string | null;
}): PhaseConfig | undefined {
  const instanceData = processInstance.instanceData as DecisionInstanceData;
  const currentPhaseId = processInstance.currentStateId;

  if (!currentPhaseId) {
    return undefined;
  }

  const currentPhase = instanceData.phases.find(
    (p) =>
      p.phaseId === currentPhaseId ||
      // @ts-expect-error  Remove p.stateId in a migration before undoing p.stateId
      p.stateId === currentPhaseId,
  );

  if (!currentPhase) {
    return undefined;
  }

  return {
    allowProposals: currentPhase.rules?.proposals?.submit ?? false,
    allowDecisions: currentPhase.rules?.voting?.submit ?? false,
    maxVotesPerMember: currentPhase.rules?.voting?.maxVotesPerMember,
  };
}

function buildVotingSchemaResult(phaseConfig: PhaseConfig) {
  const result = processDecisionProcessSchema({
    allowProposals: phaseConfig.allowProposals,
    allowDecisions: phaseConfig.allowDecisions,
    instanceData: { maxVotesPerMember: phaseConfig.maxVotesPerMember },
    schemaType: 'simple',
  });

  if (!result.isValid || !result.votingConfig) {
    throw new ValidationError('Invalid process schema');
  }

  return { ...result, votingConfig: result.votingConfig };
}

export type CustomData = Record<string, unknown>;

export interface SubmitVoteInput {
  processInstanceId: string;
  selectedProposalIds: string[];
  schemaVersion?: string;
  customData?: CustomData;
  authUserId: string;
}

export interface GetVotingStatusInput {
  processInstanceId: string;
  authUserId: string;
}

export interface ValidateVoteSelectionInput {
  processInstanceId: string;
  selectedProposalIds: string[];
  authUserId: string;
}

export interface VoteSubmissionResult {
  id: string;
  processInstanceId: string;
  submittedByProfileId: string;
  selectedProposalIds: string[];
  createdAt: Date;
  signature: string | null;
  schemaVersion: string;
  schemaType: string;
}

export interface VotingStatusResult {
  hasVoted: boolean;
  voteSubmission: VoteSubmissionResult | null;
  selectedProposals: Array<{
    id: string;
    title: string;
    amount?: number;
    schemaSpecificDisplay?: any;
  }> | null;
  votingConfiguration: {
    allowDecisions: boolean;
    maxVotesPerMember: VoteCap;
    schemaType: string;
    isReadOnly: boolean;
  };
}

export interface VoteValidationResult {
  isValid: boolean;
  errors: string[];
  maxVotesAllowed: number;
  schemaConstraints: {
    schemaType: string;
    allowDecisions: boolean;
    additionalValidation?: any;
  };
  proposalValidation: Array<{
    proposalId: string;
    isValid: boolean;
    errors: string[];
  }>;
}

const createVoteSignature = (proposalIds: string[], userId: string): string => {
  const data = {
    proposalIds: proposalIds.sort(),
    userId,
    timestamp: new Date().toISOString(),
  };

  return Buffer.from(JSON.stringify(data)).toString('base64');
};

export const submitVote = async ({
  data,
  authUserId,
}: {
  data: SubmitVoteInput;
  authUserId: string;
}): Promise<VoteSubmissionResult> => {
  if (!authUserId) {
    throw new UnauthorizedError('User must be authenticated');
  }

  try {
    const profileId = await getIndividualProfileId(authUserId);

    // Get process instance and schema
    const processInstance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, data.processInstanceId),
      columns: {
        id: true,
        profileId: true,
        ownerProfileId: true,
        instanceData: true,
        currentStateId: true,
      },
    });

    if (!processInstance) {
      throw new NotFoundError('Process instance not found');
    }

    if (!processInstance.profileId) {
      throw new NotFoundError('Decision profile not found');
    }

    // Check user permissions
    const profileUser = await getProfileAccessUser({
      user: { id: authUserId },
      profileId: processInstance.profileId,
    });

    assertAccess(
      [{ decisions: permission.ADMIN }, { decisions: decisionPermission.VOTE }],
      profileUser?.roles ?? [],
    );

    const phaseConfig = getCurrentPhaseConfig(processInstance);

    if (!phaseConfig) {
      throw new ValidationError('Current state not found');
    }

    const schemaResult = buildVotingSchemaResult(phaseConfig);
    const { votingConfig } = schemaResult;

    if (!votingConfig.allowDecisions) {
      throw new ValidationError(
        'Voting is not currently allowed for this process',
      );
    }

    // Check if user has already voted
    const existingVote = await db._query.decisionsVoteSubmissions.findFirst({
      where: and(
        eq(decisionsVoteSubmissions.processInstanceId, data.processInstanceId),
        eq(decisionsVoteSubmissions.submittedByProfileId, profileId),
      ),
    });

    if (existingVote) {
      throw new ValidationError(
        'User has already submitted a vote for this process',
      );
    }

    // Get available proposals for this process instance
    const availableProposals = await db._query.proposals.findMany({
      where: eq(proposals.processInstanceId, data.processInstanceId),
    });

    // Filter to eligible proposals for voting
    const eligibleProposals = availableProposals.filter((p) =>
      isVotingEligible(p.status),
    );
    const eligibleProposalIds = eligibleProposals.map((p) => p.id);

    // Check if all selected proposals are eligible
    const hasIneligibleSelections = data.selectedProposalIds.some(
      (id) => !eligibleProposalIds.includes(id),
    );

    if (hasIneligibleSelections) {
      throw new ValidationError(
        'Some of your selections are not eligible for voting.',
      );
    }

    // Validate the vote selection
    const validation = validateVoteSelection(
      data.selectedProposalIds,
      votingConfig.maxVotesPerMember,
      eligibleProposalIds,
    );

    if (!validation.isValid) {
      throw new ValidationError(
        `Invalid vote selection: ${validation.errors.join(', ')}`,
      );
    }

    // Create vote submission record
    const voteData: VoteData = {
      schemaVersion: data.schemaVersion || '1.0.0',
      schemaType: schemaResult.schemaType,
      submissionMetadata: {
        timestamp: new Date().toISOString(),
        userAgent: 'unknown',
      },
      validationSignature: createVoteSignature(
        data.selectedProposalIds,
        profileId,
      ),
    };

    // Use transaction to create vote submission and join table entries
    const result = await db.transaction(async (tx) => {
      // Create the vote submission
      const [voteSubmission] = await tx
        .insert(decisionsVoteSubmissions)
        .values({
          processInstanceId: data.processInstanceId,
          submittedByProfileId: profileId,
          voteData,
          customData: data.customData,
          signature: voteData.validationSignature,
        })
        .returning();

      if (!voteSubmission) {
        throw new CommonError('Failed to create vote submission');
      }

      // Create join table entries for selected proposals
      const voteProposalEntries = data.selectedProposalIds.map(
        (proposalId) => ({
          voteSubmissionId: voteSubmission.id,
          proposalId,
        }),
      );

      await tx.insert(decisionsVoteProposals).values(voteProposalEntries);

      return {
        voteSubmission,
        selectedProposalIds: data.selectedProposalIds,
      };
    });

    return {
      id: result.voteSubmission.id,
      processInstanceId: result.voteSubmission.processInstanceId,
      submittedByProfileId: result.voteSubmission.submittedByProfileId,
      selectedProposalIds: result.selectedProposalIds,
      createdAt: new Date(result.voteSubmission.createdAt!),
      signature: result.voteSubmission.signature || null,
      schemaVersion: voteData.schemaVersion,
      schemaType: voteData.schemaType,
    };
  } catch (error) {
    if (error instanceof CommonError) {
      throw error;
    }
    console.error('Error submitting vote:', error);
    throw new CommonError('Failed to submit vote');
  }
};

export const getVotingStatus = async ({
  data,
  authUserId,
}: {
  data: GetVotingStatusInput;
  authUserId: string;
}): Promise<VotingStatusResult> => {
  if (!authUserId) {
    throw new UnauthorizedError('User must be authenticated');
  }

  try {
    const profileId = await getIndividualProfileId(authUserId);

    // Get process instance and schema
    const processInstance = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, data.processInstanceId),
      columns: {
        id: true,
        profileId: true,
        ownerProfileId: true,
        instanceData: true,
        currentStateId: true,
      },
    });

    if (!processInstance) {
      throw new NotFoundError('Process instance not found');
    }

    await assertInstanceProfileAccess({
      user: { id: authUserId },
      instance: processInstance,
      profilePermissions: { decisions: permission.READ },
      orgFallbackPermissions: [{ decisions: permission.READ }],
    });

    const phaseConfig = getCurrentPhaseConfig(processInstance);

    if (!phaseConfig) {
      throw new ValidationError('Current state not found');
    }

    const schemaResult = buildVotingSchemaResult(phaseConfig);
    const { votingConfig } = schemaResult;

    // Check if user has voted
    const voteSubmission = await db._query.decisionsVoteSubmissions.findFirst({
      where: and(
        eq(decisionsVoteSubmissions.processInstanceId, data.processInstanceId),
        eq(decisionsVoteSubmissions.submittedByProfileId, profileId),
      ),
      with: {
        voteProposals: {
          with: {
            proposal: {
              with: {
                profile: {
                  columns: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    let selectedProposals = null;
    let selectedProposalIds: string[] = [];

    if (voteSubmission) {
      // Get proposal details from the join table
      selectedProposalIds = voteSubmission.voteProposals.map(
        (vp) => vp.proposalId,
      );
      selectedProposals = voteSubmission.voteProposals.map((vp) => ({
        id: vp.proposal.id,
        title: vp.proposal.profile?.name || 'Untitled',
        amount: (vp.proposal.proposalData as any)?.amount,
        schemaSpecificDisplay: (vp.proposal.proposalData as any)
          ?.schemaSpecificDisplay,
      }));
    }

    return {
      hasVoted: !!voteSubmission,
      voteSubmission: voteSubmission
        ? {
            id: voteSubmission.id,
            processInstanceId: voteSubmission.processInstanceId,
            submittedByProfileId: voteSubmission.submittedByProfileId,
            selectedProposalIds,
            createdAt: new Date(voteSubmission.createdAt!),
            signature: voteSubmission.signature,
            schemaVersion: voteSubmission.voteData.schemaVersion,
            schemaType: voteSubmission.voteData.schemaType,
          }
        : null,
      selectedProposals,
      votingConfiguration: {
        allowDecisions: votingConfig.allowDecisions,
        maxVotesPerMember: votingConfig.maxVotesPerMember,
        schemaType: schemaResult.schemaType,
        isReadOnly: !!voteSubmission || !votingConfig.allowDecisions,
      },
    };
  } catch (error) {
    if (error instanceof CommonError) {
      throw error;
    }
    console.error('Error getting voting status:', error);
    throw new CommonError('Failed to get voting status');
  }
};
