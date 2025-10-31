import { and, db, eq } from '@op/db/client';
import {
  type VoteData,
  decisionsVoteProposals,
  decisionsVoteSubmissions,
  organizations,
  processInstances,
  proposals,
} from '@op/db/schema';
import { assertAccess, permission } from 'access-zones';

import { processDecisionProcessSchema } from '../../lib/schema-registry';
import { validateVoteSelection } from '../../lib/schema-validators';
import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils';
import { getCurrentProfileId, getOrgAccessUser } from '../access';

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
    const profileId = await getCurrentProfileId(authUserId);

    // Get process instance and schema
    const processInstance = await db.query.processInstances.findFirst({
      where: eq(processInstances.id, data.processInstanceId),
      with: {
        process: true,
      },
    });

    if (!processInstance) {
      throw new NotFoundError('Process instance not found');
    }

    // Get organization from owner profile
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.profileId, processInstance.ownerProfileId),
    });

    const organizationId = org?.id;
    if (!organizationId) {
      throw new NotFoundError('Organization not found');
    }

    // Check user permissions
    const orgUser = await getOrgAccessUser({
      user: { id: authUserId },
      organizationId,
    });

    assertAccess({ decisions: permission.UPDATE }, orgUser?.roles ?? []);

    // Extract voting configuration from current state
    const currentStateId = (processInstance.instanceData as any)
      ?.currentStateId;
    const currentState = (
      processInstance.process as any
    )?.processSchema?.states?.find((s: any) => s.id === currentStateId);

    if (!currentState) {
      throw new ValidationError('Current state not found');
    }

    console.log(
      'VOTING VALIDATION: maxVotesPerMember',
      (processInstance.instanceData as any)?.fieldValues?.maxVotesPerMember,
    );
    // Build schema data for validation
    const schemaData = {
      allowProposals: currentState.config?.allowProposals || false,
      allowDecisions: currentState.config?.allowDecisions || false,
      instanceData: {
        maxVotesPerMember:
          (processInstance.instanceData as any)?.fieldValues
            ?.maxVotesPerMember || 5,
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
    const existingVote = await db.query.decisionsVoteSubmissions.findFirst({
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
    const availableProposals = await db.query.proposals.findMany({
      where: eq(proposals.processInstanceId, data.processInstanceId),
    });

    const availableProposalIds = availableProposals.map((p) => p.id);

    // Validate the vote selection
    const validation = validateVoteSelection(
      data.selectedProposalIds,
      votingConfig.maxVotesPerMember,
      availableProposalIds,
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
    const profileId = await getCurrentProfileId(authUserId);

    // Get process instance and schema
    const processInstance = await db.query.processInstances.findFirst({
      where: eq(processInstances.id, data.processInstanceId),
      with: {
        process: true,
      },
    });

    if (!processInstance) {
      throw new NotFoundError('Process instance not found');
    }

    // Get organization from owner profile
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.profileId, processInstance.ownerProfileId),
    });

    const organizationId = org?.id;
    if (!organizationId) {
      throw new NotFoundError('Organization not found');
    }

    // Check user permissions
    const orgUser = await getOrgAccessUser({
      user: { id: authUserId },
      organizationId,
    });

    assertAccess({ decisions: permission.READ }, orgUser?.roles ?? []);

    // Extract voting configuration from current state
    const currentStateId = (processInstance.instanceData as any)
      ?.currentStateId;
    const currentState = (
      processInstance.process as any
    )?.processSchema?.states?.find((s: any) => s.id === currentStateId);

    if (!currentState) {
      throw new ValidationError('Current state not found');
    }

    // Build schema data for validation
    const schemaData = {
      allowProposals: currentState.config?.allowProposals || false,
      allowDecisions: currentState.config?.allowDecisions || false,
      instanceData: {
        maxVotesPerMember:
          (processInstance.instanceData as any)?.fieldValues
            .maxVotesPerMember || 3,
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
    const voteSubmission = await db.query.decisionsVoteSubmissions.findFirst({
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

export const validateVoteSelectionService = async ({
  data,
  authUserId,
}: {
  data: ValidateVoteSelectionInput;
  authUserId: string;
}): Promise<VoteValidationResult> => {
  if (!authUserId) {
    throw new UnauthorizedError('User must be authenticated');
  }

  try {
    // Get process instance and schema
    const processInstance = await db.query.processInstances.findFirst({
      where: eq(processInstances.id, data.processInstanceId),
      with: {
        process: true,
      },
    });

    if (!processInstance) {
      throw new NotFoundError('Process instance not found');
    }

    // Get organization from owner profile
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.profileId, processInstance.ownerProfileId),
    });

    const organizationId = org?.id;
    if (!organizationId) {
      throw new NotFoundError('Organization not found');
    }

    // Check user permissions
    const orgUser = await getOrgAccessUser({
      user: { id: authUserId },
      organizationId,
    });

    assertAccess({ decisions: permission.READ }, orgUser?.roles ?? []);

    // Extract voting configuration from current state
    const currentStateId = (processInstance.instanceData as any)
      ?.currentStateId;
    const currentState = (
      processInstance.process as any
    )?.processSchema?.states?.find((s: any) => s.id === currentStateId);

    if (!currentState) {
      return {
        isValid: false,
        errors: ['Current state not found'],
        maxVotesAllowed: 0,
        schemaConstraints: {
          schemaType: 'invalid',
          allowDecisions: false,
        },
        proposalValidation: [],
      };
    }

    // Build schema data for validation
    const schemaData = {
      allowProposals: currentState.config?.allowProposals || false,
      allowDecisions: currentState.config?.allowDecisions || false,
      instanceData: {
        maxVotesPerMember:
          (processInstance.instanceData as any)?.maxVotesPerMember || 3,
      },
      schemaType: 'simple',
    };

    const schemaResult = processDecisionProcessSchema(schemaData);

    if (!schemaResult.isValid || !schemaResult.votingConfig) {
      return {
        isValid: false,
        errors: ['Invalid process schema'],
        maxVotesAllowed: 0,
        schemaConstraints: {
          schemaType: 'invalid',
          allowDecisions: false,
        },
        proposalValidation: [],
      };
    }

    const { votingConfig } = schemaResult;

    // Get available proposals
    const availableProposals = await db.query.proposals.findMany({
      where: eq(proposals.processInstanceId, data.processInstanceId),
    });

    const availableProposalIds = availableProposals.map((p) => p.id);

    // Validate selection
    const validation = validateVoteSelection(
      data.selectedProposalIds,
      votingConfig.maxVotesPerMember,
      availableProposalIds,
    );

    // Validate individual proposals
    const proposalValidation = data.selectedProposalIds.map(
      (proposalId: string) => {
        const proposal = availableProposals.find((p) => p.id === proposalId);
        const errors: string[] = [];

        if (!proposal) {
          errors.push('Proposal not found');
        } else if (proposal.status !== 'submitted') {
          errors.push('Proposal is not available for voting');
        }

        return {
          proposalId,
          isValid: errors.length === 0,
          errors,
        };
      },
    );

    return {
      isValid: validation.isValid,
      errors: validation.errors,
      maxVotesAllowed: votingConfig.maxVotesPerMember,
      schemaConstraints: {
        schemaType: schemaResult.schemaType,
        allowDecisions: votingConfig.allowDecisions,
        additionalValidation: votingConfig.additionalConfig,
      },
      proposalValidation,
    };
  } catch (error) {
    if (error instanceof CommonError) {
      throw error;
    }
    console.error('Error validating vote selection:', error);
    throw new CommonError('Failed to validate vote selection');
  }
};
