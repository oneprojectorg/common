import { trackUserVoted } from '@op/analytics';
import { and, db, eq, isNull } from '@op/db/client';
import {
  type VoteData,
  decisionsVoteProposals,
  decisionsVoteSubmissions,
  processInstances,
  proposals,
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
import {
  type AmountUnit,
  DEFAULT_AMOUNT_UNIT,
  getTemplateBudgetUnit,
  resolveUnitAmount,
} from './budgetUnit';
import { decisionPermission } from './permissions';
import type { BudgetData } from './proposalDataSchema';
import { resolveProposalBudgets } from './resolveProposalBudgets';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import { processDecisionProcessSchema } from './schemaRegistry';
import { validateVoteBudget, validateVoteSelection } from './schemaValidators';
import type { DecisionInstanceData } from './schemas/instanceData';
import {
  getVoterBudget,
  isRankedVoting,
  isVotingPhase,
} from './utils/phaseSettings';
import { isVotingEligible } from './votingEligibility';

/** The per-selection ballot snapshot, as `vote_data` stores it. */
type BallotSelections = NonNullable<VoteData['selections']>;

interface PhaseConfig {
  allowProposals: boolean;
  allowDecisions: boolean;
  maxVotesPerMember: number | undefined;
  /** Knapsack cap, in the template's budget unit. Undefined = no cap. */
  voterBudget: number | undefined;
  /** Selection order is persisted as a rank on each join row. */
  ranked: boolean;
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
    ranked: isRankedVoting(currentPhase),
  };
}

/**
 * What each of `selectedProposals` costs, in the unit the process counts in.
 *
 * The costs come from the live document fragments, not the proposalData
 * snapshot, so a budget edited after submission is the one enforced.
 *
 * A phase with no budget cap resolves nothing — neither the template nor the
 * documents — because every cost would go unread.
 */
async function resolveBallotCosts({
  processInstance,
  selectedProposals,
  voterBudget,
}: {
  processInstance: { instanceData: unknown; processId: string };
  selectedProposals: Array<{ id: string; proposalData: unknown }>;
  voterBudget: number | undefined;
}): Promise<{ unit: AmountUnit; costs: Map<string, BudgetData | null> }> {
  if (voterBudget === undefined) {
    return { unit: DEFAULT_AMOUNT_UNIT, costs: new Map() };
  }

  const proposalTemplate = await resolveProposalTemplate(
    processInstance.instanceData as Record<string, unknown> | null,
    processInstance.processId,
  );

  return {
    unit: getTemplateBudgetUnit(proposalTemplate) ?? DEFAULT_AMOUNT_UNIT,
    costs: await resolveProposalBudgets(selectedProposals, proposalTemplate),
  };
}

/** The instance columns both ballot entry points read. */
async function loadVotingInstance(processInstanceId: string) {
  const processInstance = await db._query.processInstances.findFirst({
    where: eq(processInstances.id, processInstanceId),
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

/**
 * Checks a ballot against every cap the phase applies, and prices it.
 *
 * The count cap and the budget cap are independent, so both run and the voter
 * is told everything that is wrong with the ballot at once rather than one
 * problem per attempt.
 *
 * @throws {ValidationError} when the ballot fails either cap
 */
async function priceAndValidateBallot({
  data,
  phaseConfig,
  processInstance,
  selectedProposals,
  eligibleProposalIds,
  maxVotesPerMember,
}: {
  data: SubmitVoteInput;
  phaseConfig: PhaseConfig;
  processInstance: { instanceData: unknown; processId: string };
  selectedProposals: Array<{ id: string; proposalData: unknown }>;
  eligibleProposalIds: ReadonlySet<string>;
  maxVotesPerMember: number | undefined;
}): Promise<{
  unit: AmountUnit;
  selections: BallotSelections;
  totalCost: number;
}> {
  const selection = validateVoteSelection(
    data.selectedProposalIds,
    maxVotesPerMember,
    [...eligibleProposalIds],
  );

  const { unit, costs } = await resolveBallotCosts({
    processInstance,
    selectedProposals,
    voterBudget: phaseConfig.voterBudget,
  });

  const budget = validateVoteBudget(
    data.selectedProposalIds,
    phaseConfig.voterBudget,
    costs,
    unit,
  );

  // What the ballot was made of, kept on the submission so tallying can read
  // it later without re-resolving budgets that may have moved on.
  const selections = data.selectedProposalIds.map((proposalId, index) => ({
    proposalId,
    cost: resolveUnitAmount(costs.get(proposalId), unit)?.amount ?? null,
    ...(phaseConfig.ranked && { rank: index + 1 }),
  }));

  // Before the throw: a rejection caused by a cost nobody could price is
  // exactly the case worth seeing in the logs.
  warnOnUnpricedSelections({
    processInstanceId: data.processInstanceId,
    selections,
    costs,
    unit,
  });

  const errors = [...selection.errors, ...budget.errors];

  if (errors.length > 0) {
    throw new ValidationError(`Invalid vote selection: ${errors.join(', ')}`);
  }

  return { unit, selections, totalCost: budget.totalCost };
}

/**
 * Flags a selection that carried a budget the process unit could not price, so
 * a template whose unit no longer matches its stored values is visible rather
 * than silently free. Never names the voter — a ballot is secret.
 */
function warnOnUnpricedSelections({
  processInstanceId,
  selections,
  costs,
  unit,
}: {
  processInstanceId: string;
  selections: BallotSelections;
  costs: ReadonlyMap<string, BudgetData | null>;
  unit: AmountUnit;
}): void {
  for (const { proposalId, cost } of selections) {
    // A proposal with no stored budget is free by design; only one that has
    // a budget we failed to read is worth a warning.
    if (cost === null && costs.get(proposalId) != null) {
      logger.warn('Proposal budget is unresolvable in the process unit', {
        processInstanceId,
        proposalId,
        unitKind: unit.kind,
      });
    }
  }
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
    /** Knapsack cap, in `budgetUnit`. Undefined = no budget cap. */
    voterBudget: number | undefined;
    /** Ballots persist their selection order as a rank. */
    ranked: boolean;
    /** Unit the cap is counted in; undefined when the template collects no budget. */
    budgetUnit: AmountUnit | undefined;
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
    // Copy before sorting: `sort` is in place, and the caller's array is the
    // ballot in submission order — which the snapshot (and ranked voting)
    // depends on.
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

    const processInstance = await loadVotingInstance(data.processInstanceId);

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

    // Get available proposals for this process instance. Moderation-detached
    // (CSAM) rows must never be votable, so we require both
    // `deletedAt IS NULL` and `moderationDetachedAt IS NULL` at query time —
    // filtering post-fetch would still leak the row to the eligibility check.
    const availableProposals = await db._query.proposals.findMany({
      where: and(
        eq(proposals.processInstanceId, data.processInstanceId),
        isNull(proposals.deletedAt),
        isNull(proposals.moderationDetachedAt),
      ),
    });

    // Filter to eligible proposals for voting
    const eligibleProposals = availableProposals.filter((p) =>
      isVotingEligible(p.status),
    );
    const eligibleProposalIds = new Set(eligibleProposals.map((p) => p.id));

    // Check if all selected proposals are eligible
    const hasIneligibleSelections = data.selectedProposalIds.some(
      (id) => !eligibleProposalIds.has(id),
    );

    if (hasIneligibleSelections) {
      throw new ValidationError(
        'Some of your selections are not eligible for voting.',
      );
    }

    const { unit, selections, totalCost } = await priceAndValidateBallot({
      data,
      phaseConfig,
      processInstance,
      selectedProposals: eligibleProposals.filter((p) =>
        data.selectedProposalIds.includes(p.id),
      ),
      eligibleProposalIds,
      maxVotesPerMember: votingConfig.maxVotesPerMember,
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
      // Only meaningful when a cap actually applied.
      ...(phaseConfig.voterBudget !== undefined && {
        voterBudget: phaseConfig.voterBudget,
        budgetUnit: unit,
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

      // Create join table entries for selected proposals. On a ranked phase
      // the incoming order IS the rank; everything else leaves it null.
      const voteProposalEntries = data.selectedProposalIds.map(
        (proposalId, index) => ({
          voteSubmissionId: voteSubmission.id,
          proposalId,
          rank: phaseConfig.ranked ? index + 1 : null,
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

    const processInstance = await loadVotingInstance(data.processInstanceId);

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
    let voteSubmission = null;
    if (profileId) {
      voteSubmission = await db.query.decisionsVoteSubmissions.findFirst({
        where: {
          processInstanceId: data.processInstanceId,
          submittedByProfileId: profileId,
        },
        with: {
          voteProposals: {
            // Ranked ballots read back in the order they were cast. Ordered
            // in SQL so the caller never re-sorts; Postgres puts NULLs last
            // on ASC, which is where an unranked selection belongs.
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
      });
    }

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

    // The unit the cap is expressed in lives on the template, so the client
    // can render "x of y" without re-deriving it.
    const proposalTemplate = await resolveProposalTemplate(
      processInstance.instanceData as Record<string, unknown> | null,
      processInstance.processId,
    );

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
        voterBudget: phaseConfig.voterBudget,
        budgetUnit: getTemplateBudgetUnit(proposalTemplate),
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
