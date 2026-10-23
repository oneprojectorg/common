import { trackUserVoted } from '@op/analytics';
import { db, eq } from '@op/db/client';
import {
  DecisionVoterEnrolmentStatus,
  type VoteData,
  decisionsVoteProposals,
  decisionsVoteSubmissions,
} from '@op/db/schema';
import { logger } from '@op/logging';
import type { User } from '@op/supabase/lib';
import type { AmountUnit } from '@op/types/amountUnit';
import { waitUntil } from '@vercel/functions';
import { permission } from 'access-zones';

import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  VoteOutsideDistrictError,
  VoteRevisionNotAllowedError,
  VoterNotEnrolledError,
} from '../../utils';
import { assertInstanceProfileAccess, getIndividualProfileId } from '../access';
import { assertProfileAccess } from '../assert';
import { getFieldUnit } from './fieldUnit';
import { type ProposalCosts, getProposalCosts } from './getProposalCosts';
import { decisionPermission } from './permissions';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import { processDecisionProcessSchema } from './schemaRegistry';
import { validateVoteBudget, validateVoteSelection } from './schemaValidators';
import type { DecisionInstanceData } from './schemas/instanceData';
import type { ProposalTemplateSchema } from './types';
import {
  canEditVotes,
  getVoterBudget,
  getVoterCostField,
  getVoterEnrolment,
  isRankedVoting,
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
  ranked: boolean;
  enrolment: ReturnType<typeof getVoterEnrolment>;
  canEditVotes: boolean;
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
    ranked: isRankedVoting(currentPhase),
    enrolment: getVoterEnrolment(currentPhase),
    canEditVotes: canEditVotes(currentPhase),
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
  processInstance: { instanceData: unknown; processId: string | null };
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
  processInstance: {
    id: string;
    instanceData: unknown;
    processId: string | null;
  };
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
  processInstance: {
    id: string;
    instanceData: unknown;
    processId: string | null;
  };
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

  const selections = selectedProposalIds.map((proposalId, index) => ({
    proposalId,
    cost: pricing?.costs.get(proposalId) ?? null,
    ...(phaseConfig.ranked && { rank: index + 1 }),
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
    ranked: boolean;
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

interface PreparedBallot {
  profileId: string;
  phaseConfig: PhaseConfig;
  existingVote: { id: string } | null;
  voteData: VoteData;
  selectedProposalIds: string[];
}

// Every gate and validation a ballot passes before it is written, shared by
// the first submission and a revision; only the write differs.
const prepareBallot = async ({
  data,
  authUserId,
}: {
  data: SubmitVoteInput;
  authUserId: string;
}): Promise<PreparedBallot> => {
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

  if (phaseConfig.enrolment) {
    const enrolment = await db.query.decisionVoterEnrolments.findFirst({
      where: { processInstanceId: data.processInstanceId, profileId },
    });

    if (enrolment?.status !== DecisionVoterEnrolmentStatus.ENROLLED) {
      throw new VoterNotEnrolledError();
    }

    await assertSelectionsInDistrict({
      boundaryId: enrolment.boundaryId,
      selectedProposalIds: data.selectedProposalIds,
    });
  }

  // Check if user has already voted
  const existingVote = await db.query.decisionsVoteSubmissions.findFirst({
    where: {
      processInstanceId: data.processInstanceId,
      submittedByProfileId: profileId,
    },
    columns: { id: true },
  });

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

  return {
    profileId,
    phaseConfig,
    existingVote: existingVote ?? null,
    voteData,
    selectedProposalIds: data.selectedProposalIds,
  };
};

const toSubmissionResult = (
  voteSubmission: typeof decisionsVoteSubmissions.$inferSelect,
  prepared: PreparedBallot,
): VoteSubmissionResult => ({
  id: voteSubmission.id,
  processInstanceId: voteSubmission.processInstanceId,
  submittedByProfileId: voteSubmission.submittedByProfileId,
  selectedProposalIds: prepared.selectedProposalIds,
  createdAt: new Date(voteSubmission.createdAt!),
  signature: voteSubmission.signature || null,
  schemaVersion: prepared.voteData.schemaVersion,
  schemaType: prepared.voteData.schemaType,
});

const voteProposalRows = (voteSubmissionId: string, prepared: PreparedBallot) =>
  prepared.selectedProposalIds.map((proposalId, index) => ({
    voteSubmissionId,
    proposalId,
    rank: prepared.phaseConfig.ranked ? index + 1 : null,
  }));

const rethrowAsCommon = (error: unknown, message: string): never => {
  if (error instanceof CommonError) {
    throw error;
  }
  logger.error(message, { error });
  throw new CommonError(message);
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
    const prepared = await prepareBallot({ data, authUserId });

    if (prepared.existingVote) {
      throw new ValidationError(
        'User has already submitted a vote for this process',
      );
    }

    const voteSubmission = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(decisionsVoteSubmissions)
        .values({
          processInstanceId: data.processInstanceId,
          submittedByProfileId: prepared.profileId,
          voteData: prepared.voteData,
          customData: data.customData,
          signature: prepared.voteData.validationSignature,
        })
        .returning();

      if (!created) {
        throw new CommonError('Failed to create vote submission');
      }

      await tx
        .insert(decisionsVoteProposals)
        .values(voteProposalRows(created.id, prepared));

      return created;
    });

    try {
      waitUntil(trackUserVoted(authUserId, voteSubmission.processInstanceId));
    } catch (err) {
      // waitUntil can throw synchronously off-Vercel (no request context).
      // Swallow here so analytics never causes "Failed to submit vote".
      logger.error('Failed to schedule user_voted tracking', { error: err });
    }

    return toSubmissionResult(voteSubmission, prepared);
  } catch (error) {
    return rethrowAsCommon(error, 'Failed to submit vote');
  }
};

export const reviseVote = async ({
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
    const prepared = await prepareBallot({ data, authUserId });

    if (!prepared.existingVote) {
      throw new ValidationError('No ballot has been cast to revise');
    }

    if (!prepared.phaseConfig.canEditVotes) {
      throw new VoteRevisionNotAllowedError();
    }

    const existingId = prepared.existingVote.id;
    const voteSubmission = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(decisionsVoteSubmissions)
        .set({
          voteData: prepared.voteData,
          customData: data.customData,
          signature: prepared.voteData.validationSignature,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(decisionsVoteSubmissions.id, existingId))
        .returning();

      if (!updated) {
        throw new CommonError('Failed to revise vote submission');
      }

      await tx
        .delete(decisionsVoteProposals)
        .where(eq(decisionsVoteProposals.voteSubmissionId, existingId));
      await tx
        .insert(decisionsVoteProposals)
        .values(voteProposalRows(existingId, prepared));

      return updated;
    });

    return toSubmissionResult(voteSubmission, prepared);
  } catch (error) {
    return rethrowAsCommon(error, 'Failed to revise vote');
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
                // Postgres sorts NULLs last, so unranked ballots keep creation order.
                orderBy: { rank: 'asc', createdAt: 'asc' },
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
        ranked: phaseConfig.ranked,
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

async function assertSelectionsInDistrict({
  boundaryId,
  selectedProposalIds,
}: {
  boundaryId: string | null;
  selectedProposalIds: string[];
}): Promise<void> {
  if (!boundaryId || selectedProposalIds.length === 0) {
    return;
  }

  const boundary = await db.query.decisionBoundaries.findFirst({
    where: { id: boundaryId },
    columns: { taxonomyTermId: true },
  });

  if (!boundary?.taxonomyTermId) {
    return;
  }

  const tagged = await db.query.proposalCategories.findMany({
    where: {
      taxonomyTermId: boundary.taxonomyTermId,
      proposalId: { in: selectedProposalIds },
    },
    columns: { proposalId: true },
  });
  const inDistrict = new Set(tagged.map((row) => row.proposalId));

  if (selectedProposalIds.some((id) => !inDistrict.has(id))) {
    throw new VoteOutsideDistrictError();
  }
}
