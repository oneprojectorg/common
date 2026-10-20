import { trackUserVoted } from '@op/analytics';
import { db } from '@op/db/client';
import {
  type VoteData,
  decisionsVoteProposals,
  decisionsVoteSubmissions,
} from '@op/db/schema';
import { logger } from '@op/logging';
import type { User } from '@op/supabase/lib';
import { waitUntil } from '@vercel/functions';
import { permission } from 'access-zones';

import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils';
import { assertInstanceProfileAccess, getIndividualProfileId } from '../access';
import { assertProfileAccess } from '../assert';
import { type AmountUnit, getFieldUnit } from './fieldUnit';
import { type ProposalCosts, getProposalCosts } from './getProposalCosts';
import { decisionPermission } from './permissions';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import { processDecisionProcessSchema } from './schemaRegistry';
import { validateVoteBudget, validateVoteSelection } from './schemaValidators';
import type { DecisionInstanceData } from './schemas/instanceData';
import type { ProposalTemplateSchema } from './types';
import {
  getVoterCostField,
  getVoterBudget,
  isVotingPhase,
} from './utils/phaseSettings';
import { isVotingEligible } from './votingEligibility';

type BallotSelections = NonNullable<VoteData['selections']>;

interface PhaseConfig {
  allowProposals: boolean;
  allowDecisions: boolean;
  maxVotesPerMember: number | undefined;
  voterBudget: number | undefined;
  voterCostField: string;
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
    allowDecisions: isVotingPhase(currentPhase),
    maxVotesPerMember: currentPhase.rules?.voting?.maxVotesPerMember,
    voterBudget: getVoterBudget(currentPhase),
    voterCostField: getVoterCostField(currentPhase),
  };
}

interface VoteCap {
  voterBudget: number;
  voterCostField: string;
  /** Undefined when the rules name a field the template no longer prices. */
  unit: AmountUnit | undefined;
  proposalTemplate: ProposalTemplateSchema | null;
}

// Undefined when the phase sets no cap.
async function getVoteCap({
  phaseConfig,
  processInstance,
}: {
  phaseConfig: PhaseConfig;
  processInstance: { instanceData: unknown; processId: string };
}): Promise<VoteCap | undefined> {
  if (phaseConfig.voterBudget === undefined) {
    return undefined;
  }

  const proposalTemplate = await resolveProposalTemplate(
    processInstance.instanceData as Record<string, unknown> | null,
    processInstance.processId,
  );

  return {
    voterBudget: phaseConfig.voterBudget,
    voterCostField: phaseConfig.voterCostField,
    unit: getFieldUnit(
      proposalTemplate?.properties?.[phaseConfig.voterCostField],
    ),
    proposalTemplate,
  };
}

type PricedBallot = Omit<VoteCap, 'unit' | 'proposalTemplate'> & {
  unit: AmountUnit;
  costs: ProposalCosts;
};

// Costs come from the live fragments; skipped entirely when no cap applies.
async function getBallotPricing({
  phaseConfig,
  processInstance,
  eligibleProposals,
  selectedProposalIds,
}: {
  phaseConfig: PhaseConfig;
  processInstance: { id: string; instanceData: unknown; processId: string };
  eligibleProposals: Array<{ id: string; proposalData: unknown }>;
  selectedProposalIds: string[];
}): Promise<PricedBallot | undefined> {
  const cap = await getVoteCap({ phaseConfig, processInstance });

  if (!cap) {
    return undefined;
  }

  const { unit, proposalTemplate, ...rest } = cap;

  // Fail closed: an uncapped ballot on a capped phase is the worse outcome.
  if (!unit) {
    logger.warn(
      'Voting phase charges from a field the template does not price',
      {
        processInstanceId: processInstance.id,
        voterCostField: cap.voterCostField,
      },
    );
    throw new ValidationError(
      `Voting is misconfigured: "${cap.voterCostField}" is not a priced field on the proposal template.`,
    );
  }

  const selected = new Set(selectedProposalIds);

  return {
    ...rest,
    unit,
    costs: await getProposalCosts({
      proposals: eligibleProposals.filter((p) => selected.has(p.id)),
      proposalTemplate,
      voterCostField: cap.voterCostField,
      unit,
    }),
  };
}

async function getVotingInstance(processInstanceId: string) {
  const processInstance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: {
      id: true,
      profileId: true,
      ownerProfileId: true,
      processId: true,
      instanceData: true,
      currentStateId: true,
    },
  });

  if (!processInstance) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  return processInstance;
}

// Runs both caps so the voter sees every problem at once.
async function getValidatedBallot({
  selectedProposalIds,
  phaseConfig,
  processInstance,
  eligibleProposals,
}: {
  selectedProposalIds: string[];
  phaseConfig: PhaseConfig;
  processInstance: { id: string; instanceData: unknown; processId: string };
  eligibleProposals: Array<{ id: string; proposalData: unknown }>;
}): Promise<{
  pricing: PricedBallot | undefined;
  selections: BallotSelections;
  totalCost: number;
}> {
  const selection = validateVoteSelection(
    selectedProposalIds,
    phaseConfig.maxVotesPerMember,
    eligibleProposals.map((p) => p.id),
  );

  const pricing = await getBallotPricing({
    phaseConfig,
    processInstance,
    eligibleProposals,
    selectedProposalIds,
  });

  const budget = validateVoteBudget(selectedProposalIds, pricing);

  const errors = [...selection.errors, ...budget.errors];

  if (errors.length > 0) {
    throw new ValidationError(`Invalid vote selection: ${errors.join(', ')}`);
  }

  const selections = selectedProposalIds.map((proposalId) => ({
    proposalId,
    cost: pricing?.costs.get(proposalId) ?? null,
  }));

  return { pricing, selections, totalCost: budget.totalCost };
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
    schemaSpecificDisplay?: any;
  }> | null;
  votingConfiguration: {
    allowDecisions: boolean;
    maxVotesPerMember: number | undefined;
    voterBudget: number | undefined;
    voterCostField: string | undefined;
    costUnit: AmountUnit | undefined;
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
    // `sort` mutates; the caller relies on submission order.
    proposalIds: [...proposalIds].sort(),
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

    const processInstance = await getVotingInstance(data.processInstanceId);

    if (!processInstance.profileId) {
      throw new NotFoundError('Decision profile', data.processInstanceId);
    }

    // Check user permissions
    await assertProfileAccess({
      user: { id: authUserId },
      profileId: processInstance.profileId,
      permissions: [
        { decisions: permission.ADMIN },
        { decisions: decisionPermission.VOTE },
      ],
    });

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
    const existingVote = await db.query.decisionsVoteSubmissions.findFirst({
      where: {
        processInstanceId: data.processInstanceId,
        submittedByProfileId: profileId,
      },
    });

    if (existingVote) {
      throw new ValidationError(
        'User has already submitted a vote for this process',
      );
    }

    // Get available proposals for this process instance. Moderation-detached
    // (CSAM) rows must never be votable, so we require both
    // `deletedAt IS NULL` and `moderationDetachedAt IS NULL` at query time —
    // filtering post-fetch would still leak the row to the eligibility check.
    const availableProposals = await db.query.proposals.findMany({
      where: {
        processInstanceId: data.processInstanceId,
        deletedAt: { isNull: true },
        moderationDetachedAt: { isNull: true },
      },
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

    const { pricing, selections, totalCost } = await getValidatedBallot({
      selectedProposalIds: data.selectedProposalIds,
      phaseConfig,
      processInstance,
      eligibleProposals,
    });

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
      selections,
      ...(pricing && {
        voterBudget: pricing.voterBudget,
        voterCostField: pricing.voterCostField,
        costUnit: pricing.unit,
        totalCost,
      }),
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

    try {
      waitUntil(
        trackUserVoted(authUserId, result.voteSubmission.processInstanceId),
      );
    } catch (err) {
      // waitUntil can throw synchronously off-Vercel (no request context).
      // Swallow here so analytics never causes "Failed to submit vote".
      logger.error('Failed to schedule user_voted tracking', { error: err });
    }

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
    logger.error('Error submitting vote', { error });
    throw new CommonError('Failed to submit vote');
  }
};

export const getVotingStatus = async ({
  data,
  user,
}: {
  data: GetVotingStatusInput;
  user: User | undefined;
}): Promise<VotingStatusResult> => {
  try {
    // Public / anonymous callers have no individual profile (→ no ballot).
    let profileId: string | undefined;
    if (user) {
      try {
        profileId = await getIndividualProfileId(user.id);
      } catch {
        profileId = undefined;
      }
    }

    const processInstance = await getVotingInstance(data.processInstanceId);

    await assertInstanceProfileAccess({
      user,
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
    // The ballot and the cap don't depend on each other.
    const [voteSubmission, cap] = await Promise.all([
      profileId
        ? db.query.decisionsVoteSubmissions.findFirst({
            where: {
              processInstanceId: data.processInstanceId,
              submittedByProfileId: profileId,
            },
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
          })
        : null,
      getVoteCap({ phaseConfig, processInstance }),
    ]);

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
        voterBudget: cap?.voterBudget,
        voterCostField: cap?.voterCostField,
        costUnit: cap?.unit,
        schemaType: schemaResult.schemaType,
        isReadOnly: !!voteSubmission || !votingConfig.allowDecisions,
      },
    };
  } catch (error) {
    if (error instanceof CommonError) {
      throw error;
    }
    logger.error('Error getting voting status', { error });
    throw new CommonError('Failed to get voting status');
  }
};
