import { and, db, eq } from '@op/db/client';
import {
  ProposalStatus,
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

/**
 * Helper to find current phase and extract voting config.
 * Reads from instanceData.phases which now contains all template fields.
 * Returns undefined if the current phase is not found.
 */
function getCurrentPhaseConfig(processInstance: { instanceData: unknown }):
  | {
      allowProposals: boolean;
      allowDecisions: boolean;
    }
  | undefined {
  const instanceData = processInstance.instanceData as DecisionInstanceData;

  if (
    !instanceData?.currentPhaseId &&
    // @ts-expect-error - supporting legacy datatypes here that will be removed
    !instanceData?.currentStateId
  ) {
    return undefined;
  }

  const currentPhase = instanceData.phases.find(
    (p) => p.phaseId === instanceData.currentPhaseId,
  );

  if (currentPhase) {
    return {
      allowProposals: currentPhase.rules?.proposals?.submit ?? false,
      allowDecisions: currentPhase.rules?.voting?.submit ?? false,
    };
  } else {
    // Supports old data types before migration
    const currentState = instanceData.phases.find(
      // @ts-expect-error - supporting legacy datatypes here that will be removed
      (p) => p.stateId! === instanceData.currentStateId,
    );

    if (currentState) {
      return {
        allowProposals: currentState.rules?.proposals?.submit ?? false,
        allowDecisions: currentState.rules?.voting?.submit ?? false,
      };
    }
  }

  return;
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
  userId: string;
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
    maxVotesPerMember: number;
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
      },
    });

    if (!processInstance) {
      throw new NotFoundError('Process instance not found');
    }

    if (!processInstance.profileId) {
      throw new NotFoundError('Decision profile not found');
    }

    const instanceData = processInstance.instanceData as DecisionInstanceData;

    // Check user permissions
    const profileUser = await getProfileAccessUser({
      user: { id: authUserId },
      profileId: processInstance.profileId,
    });

    assertAccess(
      [{ decisions: permission.ADMIN }, { decisions: decisionPermission.VOTE }],
      profileUser?.roles ?? [],
    );

    // Extract voting configuration from current phase/state
    const phaseConfig = getCurrentPhaseConfig(processInstance);

    if (!phaseConfig) {
      throw new ValidationError('Current state not found');
    }

    // Build schema data for validation
    const schemaData = {
      allowProposals: phaseConfig.allowProposals,
      allowDecisions: phaseConfig.allowDecisions,
      instanceData: {
        maxVotesPerMember:
          Number(instanceData.fieldValues?.maxVotesPerMember) || 5,
      },
      schemaType: 'simple',
    };

    // Process the schema to validate voting is allowed
    const schemaResult = processDecisionProcessSchema(schemaData);

    if (!schemaResult.isValid || !schemaResult.votingConfig) {
      throw new ValidationError('Invalid process schema');
    }

    const { votingConfig } = schemaResult;

    // Check if voting is currently allowed
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

    // Filter to only approved proposals for voting
    const approvedProposals = availableProposals.filter(
      (p) => p.status === ProposalStatus.APPROVED,
    );
    const approvedProposalIds = approvedProposals.map((p) => p.id);

    // Check if all selected proposals are approved
    const hasNonApprovedSelections = data.selectedProposalIds.some(
      (id) => !approvedProposalIds.includes(id),
    );

    if (hasNonApprovedSelections) {
      throw new ValidationError(
        'You can only vote for approved proposals. Some of your selections are not eligible for voting.',
      );
    }

    // Validate the vote selection
    const validation = validateVoteSelection(
      data.selectedProposalIds,
      votingConfig.maxVotesPerMember,
      approvedProposalIds,
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
      userId: result.voteSubmission.submittedByProfileId,
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
      },
    });

    if (!processInstance) {
      throw new NotFoundError('Process instance not found');
    }

    const instanceData = processInstance.instanceData as DecisionInstanceData;

    await assertInstanceProfileAccess({
      user: { id: authUserId },
      instance: processInstance,
      profilePermissions: { profile: permission.READ },
      orgFallbackPermissions: [{ decisions: permission.READ }],
    });

    // Extract voting configuration from current phase/state
    const phaseConfig = getCurrentPhaseConfig(processInstance);

    if (!phaseConfig) {
      throw new ValidationError('Current state not found');
    }

    // Build schema data for validation
    const schemaData = {
      allowProposals: phaseConfig.allowProposals,
      allowDecisions: phaseConfig.allowDecisions,
      instanceData: {
        maxVotesPerMember:
          Number(instanceData.fieldValues?.maxVotesPerMember) || 3,
      },
      schemaType: 'simple',
    };

    // Process the schema
    const schemaResult = processDecisionProcessSchema(schemaData);

    if (!schemaResult.isValid || !schemaResult.votingConfig) {
      throw new ValidationError('Invalid process schema');
    }

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
            proposal: true,
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
        title: (vp.proposal.proposalData as any)?.title || 'Untitled',
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
            userId: voteSubmission.submittedByProfileId,
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
