import { trackUserVoted } from '@op/analytics';
import { db } from '@op/db/client';
import {
  type BallotData,
  type VoteData,
  decisionsVoteSubmissions,
} from '@op/db/schema';
import { logger } from '@op/logging';
import type { User } from '@op/supabase/lib';
import type { AmountUnit } from '@op/types/amountUnit';
import { waitUntil } from '@vercel/functions';
import { permission } from 'access-zones';
import { randomUUID } from 'node:crypto';

import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  VoteOutsideDistrictError,
  VoterNotEnrolledError,
} from '../../utils';
import { assertInstanceProfileAccess, getIndividualProfileId } from '../access';
import { assertProfileAccess } from '../assert';
import { castBallotIntoBox, lockBallotBox } from './ballotBox';
import {
  createBallotReceipt,
  hashBallotReceipt,
  sealBallot,
} from './ballotReceipt';
import { getFieldUnit } from './fieldUnit';
import { type ProposalCosts, getProposalCosts } from './getProposalCosts';
import {
  type VoterBallot,
  getBallotByReceipt,
  getVoterBallot,
} from './getVoterBallot';
import { decisionPermission } from './permissions';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import { processDecisionProcessSchema } from './schemaRegistry';
import { validateVoteBudget, validateVoteSelection } from './schemaValidators';
import type { DecisionInstanceData } from './schemas/instanceData';
import type { ProposalTemplateSchema } from './types';
import {
  getVoterBudget,
  getVoterCostField,
  getVoterEnrolment,
  isRankedVoting,
  isVotingPhase,
} from './utils/phaseSettings';
import { isVoterEnrolled } from './voterEnrolment';
import { isVotingEligible } from './votingEligibility';

type BallotSelections = BallotData['selections'];

interface PhaseConfig {
  allowProposals: boolean;
  allowDecisions: boolean;
  maxVotesPerMember: number | undefined;
  voterBudget: number | undefined;
  voterCostField: string;
  ranked: boolean;
  enrolment: ReturnType<typeof getVoterEnrolment>;
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

export interface GetBallotInput {
  processInstanceId: string;
  /** The receipt `submitVote` returned. */
  receipt: string;
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
  /**
   * In rank order when `ranked`. Empty for a ballot cast since votes were
   * unlinked: that one is read through `getBallot`, with its receipt.
   */
  selectedProposalIds: string[];
  /** Whether the ballot was cast on a ranked phase; outlives the phase itself. */
  ranked: boolean;
  createdAt: Date;
  signature: string | null;
  schemaVersion: string;
  schemaType: string;
}

export interface SubmitVoteResult extends VoteSubmissionResult {
  /**
   * The only key to the anonymous ballot. The database keeps its hash, so it
   * is returned here once and never again.
   */
  receipt: string;
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

export const submitVote = async ({
  data,
  authUserId,
}: {
  data: SubmitVoteInput;
  authUserId: string;
}): Promise<SubmitVoteResult> => {
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

    if (phaseConfig.enrolment) {
      const enrolment = await db.query.decisionVoterEnrolments.findFirst({
        where: { processInstanceId: data.processInstanceId, profileId },
      });

      if (!isVoterEnrolled(enrolment)) {
        throw new VoterNotEnrolledError();
      }

      await assertSelectionsInDistrict({
        taxonomyTermId: enrolment?.taxonomyTermId ?? null,
        selectedProposalIds: data.selectedProposalIds,
      });
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

    const schemaVersion = data.schemaVersion || '1.0.0';

    // The submission says who voted and nothing about the picks: no
    // selections and no signature, which used to encode both.
    const voteData: VoteData = {
      schemaVersion,
      schemaType: schemaResult.schemaType,
      submissionMetadata: {
        timestamp: new Date().toISOString(),
        userAgent: 'unknown',
      },
    };

    // The ballot says what was picked and nothing about who picked it.
    const ballotData: BallotData = {
      schemaVersion,
      schemaType: schemaResult.schemaType,
      selections,
      ...(pricing && {
        voterBudget: pricing.voterBudget,
        voterCostField: pricing.voterCostField,
        costUnit: pricing.unit,
        totalCost,
      }),
    };

    const receipt = createBallotReceipt();
    const ballotId = randomUUID();
    const picks = data.selectedProposalIds.map((proposalId, index) => ({
      ballotId,
      proposalId,
      position: index,
      rank: phaseConfig.ranked ? index + 1 : null,
    }));

    // One transaction so a voter is never recorded without their ballot, or
    // the reverse. The unique (instance, voter) index on the submission
    // rejects a second vote that raced past the check above.
    const voteSubmission = await db.transaction(async (tx) => {
      await lockBallotBox({ tx, processInstanceId: data.processInstanceId });

      const [submission] = await tx
        .insert(decisionsVoteSubmissions)
        .values({
          processInstanceId: data.processInstanceId,
          submittedByProfileId: profileId,
          voteData,
          customData: data.customData,
        })
        .returning();

      if (!submission) {
        throw new CommonError('Failed to create vote submission');
      }

      await castBallotIntoBox({
        tx,
        ballot: {
          id: ballotId,
          processInstanceId: data.processInstanceId,
          receiptHash: hashBallotReceipt({
            receipt,
            processInstanceId: data.processInstanceId,
          }),
          seal: sealBallot({
            receipt,
            processInstanceId: data.processInstanceId,
            picks,
          }),
          ballotData,
          castOn: todayUtc(),
        },
        picks,
      });

      return submission;
    });

    try {
      waitUntil(trackUserVoted(authUserId, voteSubmission.processInstanceId));
    } catch (err) {
      // waitUntil can throw synchronously off-Vercel (no request context).
      // Swallow here so analytics never causes "Failed to submit vote".
      logger.error('Failed to schedule user_voted tracking', { error: err });
    }

    return {
      id: voteSubmission.id,
      processInstanceId: voteSubmission.processInstanceId,
      submittedByProfileId: voteSubmission.submittedByProfileId,
      selectedProposalIds: data.selectedProposalIds,
      ranked: phaseConfig.ranked,
      createdAt: new Date(voteSubmission.createdAt!),
      signature: null,
      schemaVersion,
      schemaType: voteData.schemaType,
      receipt,
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

    // The submission and the cap don't depend on each other.
    const [voteSubmission, cap] = await Promise.all([
      profileId
        ? db.query.decisionsVoteSubmissions.findFirst({
            where: {
              processInstanceId: data.processInstanceId,
              submittedByProfileId: profileId,
            },
          })
        : undefined,
      getVoteCap({ phaseConfig, processInstance }),
    ]);

    // Only a ballot cast before votes were unlinked is found from here; one
    // cast since needs its receipt, which `getBallot` takes.
    const ballot =
      voteSubmission && profileId
        ? await getVoterBallot({
            processInstanceId: data.processInstanceId,
            profileId,
          })
        : undefined;

    const selectedProposals = ballot
      ? await getBallotProposals(ballot.proposalIds)
      : null;

    return {
      hasVoted: !!voteSubmission,
      voteSubmission: voteSubmission
        ? {
            id: voteSubmission.id,
            processInstanceId: voteSubmission.processInstanceId,
            submittedByProfileId: voteSubmission.submittedByProfileId,
            selectedProposalIds: ballot?.proposalIds ?? [],
            ranked: ballot?.ranked ?? false,
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

/**
 * The ballot behind a receipt, for the voter who holds it. `null` when the
 * caller has not voted on the instance or the receipt opens no ballot there.
 */
export const getBallot = async ({
  data,
  user,
}: {
  data: GetBallotInput;
  user: User;
}): Promise<VoterBallot | null> => {
  try {
    const profileId = await getIndividualProfileId(user.id);

    const processInstance = await getVotingInstance(data.processInstanceId);

    await assertInstanceProfileAccess({
      user,
      instance: processInstance,
      profilePermissions: { decisions: permission.READ },
      orgFallbackPermissions: [{ decisions: permission.READ }],
    });

    // A receipt is only good in the hands of someone who voted here.
    const voteSubmission = await db.query.decisionsVoteSubmissions.findFirst({
      where: {
        processInstanceId: data.processInstanceId,
        submittedByProfileId: profileId,
      },
      columns: { id: true },
    });

    if (!voteSubmission) {
      return null;
    }

    return (
      (await getBallotByReceipt({
        processInstanceId: data.processInstanceId,
        receipt: data.receipt,
      })) ?? null
    );
  } catch (error) {
    if (error instanceof CommonError) {
      throw error;
    }
    logger.error('Error getting ballot', { error });
    throw new CommonError('Failed to get ballot');
  }
};

/** The database runs in UTC; `cast_on` keeps the day only. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function assertSelectionsInDistrict({
  taxonomyTermId,
  selectedProposalIds,
}: {
  taxonomyTermId: string | null;
  selectedProposalIds: string[];
}): Promise<void> {
  if (!taxonomyTermId || selectedProposalIds.length === 0) {
    return;
  }

  const tagged = await db.query.proposalCategories.findMany({
    where: {
      taxonomyTermId,
      proposalId: { in: selectedProposalIds },
    },
    columns: { proposalId: true },
  });
  const inDistrict = new Set(tagged.map((row) => row.proposalId));

  if (selectedProposalIds.some((id) => !inDistrict.has(id))) {
    throw new VoteOutsideDistrictError();
  }
}

// In ballot order.
async function getBallotProposals(proposalIds: string[]) {
  if (proposalIds.length === 0) {
    return [];
  }

  const rows = await db.query.proposals.findMany({
    where: { id: { in: proposalIds } },
    columns: { id: true, proposalData: true },
    with: { profile: { columns: { name: true } } },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));

  return proposalIds.flatMap((id) => {
    const proposal = byId.get(id);

    if (!proposal) {
      return [];
    }

    return [
      {
        id: proposal.id,
        title: proposal.profile?.name || 'Untitled',
        schemaSpecificDisplay: (proposal.proposalData as any)
          ?.schemaSpecificDisplay,
      },
    ];
  });
}
