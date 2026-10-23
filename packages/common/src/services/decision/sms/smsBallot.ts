import { and, db, eq, inArray, isNull } from '@op/db/client';
import {
  decisionsVoteDraftProposals,
  decisionsVoteDrafts,
  profiles,
  proposals,
} from '@op/db/schema';
import type { AmountUnit } from '@op/types/amountUnit';

import {
  BallotCostError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  VoteOutsideDistrictError,
  VoteRevisionNotAllowedError,
  VoterNotEnrolledError,
} from '../../../utils';
import { getIndividualProfileId } from '../../access';
import { ensureBallotDraft, findBallotDraft } from '../ballotDraft';
import { ensureChatSession } from '../chatSession';
import { getFieldUnit, isAtMost, sumAmounts } from '../fieldUnit';
import { getBallotProposalByCode } from '../getBallotProposalByCode';
import { getProposalCosts } from '../getProposalCosts';
import { resolveProposalTemplate } from '../resolveProposalTemplate';
import { getInstancePhases } from '../schemas/instanceData';
import { getInstanceCurrentPhase } from '../utils/instance';
import {
  getVoterBudget,
  getVoterCostField,
  isRankedVoting,
} from '../utils/phaseSettings';
import { reviseVote, submitVote } from '../voting';
import { describeEnrolmentDecision } from './getSmsVotingDecision';
import { loadBallotScope } from './smsBallotBrowse';

export interface SmsBallotPick {
  id: string;
  code: number | null;
  title: string;
  cost: number | null;
}

export interface SmsBallotSummary {
  decisionName: string;
  district: string | null;
  unit: AmountUnit | null;
  budget: number | null;
  picks: SmsBallotPick[];
  allocated: number;
  remaining: number | null;
  ranked: boolean;
  maxPicks: number | null;
}

interface BallotKey {
  authUserId: string;
  instanceId: string;
}

const loadPricing = async (instance: {
  instanceData: unknown;
  currentStateId: string | null;
  processId: string | null;
}) => {
  const phase = getInstanceCurrentPhase({
    currentStateId: instance.currentStateId,
    instanceData: { phases: getInstancePhases(instance.instanceData) },
  });
  const budget = phase ? getVoterBudget(phase) : undefined;
  const voterCostField = phase ? getVoterCostField(phase) : 'budget';
  const proposalTemplate = await resolveProposalTemplate(
    instance.instanceData,
    instance.processId,
  );
  const unit = getFieldUnit(proposalTemplate?.properties?.[voterCostField]);
  if (budget !== undefined && !unit) {
    throw new BallotCostError(
      `Voting is misconfigured: "${voterCostField}" is not a priced field on the proposal template, so no ballot can be cast. Ask an admin to correct the decision.`,
    );
  }

  return {
    budget: budget ?? null,
    voterCostField,
    proposalTemplate,
    unit,
    ranked: phase ? isRankedVoting(phase) : false,
    maxPicks: phase?.rules?.voting?.maxVotesPerMember ?? null,
  };
};

const loadPickRows = async (ids: string[]) => {
  if (ids.length === 0) {
    return [];
  }
  const rows = await db
    .select({
      id: proposals.id,
      code: proposals.shortCode,
      title: profiles.name,
      proposalData: proposals.proposalData,
    })
    .from(proposals)
    .innerJoin(profiles, eq(profiles.id, proposals.profileId))
    .where(
      and(
        inArray(proposals.id, ids),
        isNull(proposals.deletedAt),
        isNull(proposals.moderationDetachedAt),
      ),
    );
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
};

const savePicks = async (draftId: string, picks: string[]): Promise<void> => {
  await db.transaction(async (tx) => {
    await tx
      .delete(decisionsVoteDraftProposals)
      .where(eq(decisionsVoteDraftProposals.voteDraftId, draftId));
    if (picks.length > 0) {
      await tx.insert(decisionsVoteDraftProposals).values(
        picks.map((proposalId, index) => ({
          voteDraftId: draftId,
          proposalId,
          rank: index + 1,
        })),
      );
    }
  });
};

const storedPickIds = async (draftId: string): Promise<string[]> => {
  const rows = await db.query.decisionsVoteDraftProposals.findMany({
    where: { voteDraftId: draftId },
    columns: { proposalId: true },
    orderBy: { rank: 'asc' },
  });
  return rows.map((row) => row.proposalId);
};

// A hard-deleted proposal leaves the draft by FK; a soft-deleted or
// detached one still has a row, so it is dropped here before the picks
// are listed, changed or submitted.
const loadDraftPicks = async (
  draft: { id: string },
  extraIds: string[] = [],
) => {
  const stored = await storedPickIds(draft.id);
  const rows = await loadPickRows([...stored, ...extraIds]);
  const found = new Set(rows.map((row) => row.id));
  const picks = stored.filter((id) => found.has(id));
  if (picks.length !== stored.length) {
    await savePicks(draft.id, picks);
  }
  return { picks, rows };
};

const priceRows = async (
  rows: ReadonlyArray<{ id: string; proposalData: unknown }>,
  pricing: Awaited<ReturnType<typeof loadPricing>>,
): Promise<ReadonlyMap<string, number | null>> =>
  pricing.unit && rows.length > 0
    ? getProposalCosts({
        proposals: [...rows],
        proposalTemplate: pricing.proposalTemplate,
        voterCostField: pricing.voterCostField,
        unit: pricing.unit,
        // With no cap a cost is shown, never charged, so one that cannot be
        // read must not block the pick; submitVote prices nothing then either.
        unreadable: pricing.budget === null ? 'null' : 'throw',
      })
    : new Map(rows.map(({ id }) => [id, null]));

const summarize = (
  scope: { decisionName: string; district: string | null },
  pricing: Awaited<ReturnType<typeof loadPricing>>,
  rows: ReadonlyArray<{ id: string; code: number | null; title: string }>,
  costs: ReadonlyMap<string, number | null>,
): SmsBallotSummary => {
  const picks = rows.map((row) => ({
    id: row.id,
    code: row.code,
    title: row.title,
    cost: costs.get(row.id) ?? null,
  }));
  const allocated = sumAmounts(picks.map((pick) => pick.cost ?? 0));

  return {
    decisionName: scope.decisionName,
    district: scope.district,
    unit: pricing.unit ?? null,
    budget: pricing.budget,
    picks,
    allocated,
    remaining:
      pricing.budget === null ? null : sumAmounts([pricing.budget, -allocated]),
    ranked: pricing.ranked,
    maxPicks: pricing.maxPicks,
  };
};

export async function summarizeSmsBallot(
  key: BallotKey,
): Promise<SmsBallotSummary> {
  const scope = await loadBallotScope(key);
  const [draft, pricing] = await Promise.all([
    ensureBallotDraft({
      processInstanceId: key.instanceId,
      authUserId: key.authUserId,
    }),
    loadPricing(scope.instance),
  ]);
  const { rows } = await loadDraftPicks(draft);
  const costs = await priceRows(rows, pricing);

  return summarize(scope, pricing, rows, costs);
}

export type SmsPickResult =
  | { status: 'added'; position: number; pick: SmsBallotPick }
  | { status: 'duplicate'; position: number; pick: SmsBallotPick }
  | { status: 'over_budget'; pick: SmsBallotPick; remaining: number }
  | { status: 'limit_reached'; pick: SmsBallotPick; limit: number }
  | { status: 'unknown'; code: number };

export async function addSmsBallotPicks({
  authUserId,
  instanceId,
  codes,
  phoneNumberId,
}: BallotKey & {
  codes: number[];
  /** The decision line the codes came in on, recorded on the session. */
  phoneNumberId?: string | null;
}): Promise<{
  results: SmsPickResult[];
  summary: SmsBallotSummary;
  hadPicks: boolean;
}> {
  const key = { authUserId, instanceId };
  const scope = await loadBallotScope(key);
  const [draft, pricing] = await Promise.all([
    ensureBallotDraft({ processInstanceId: instanceId, authUserId }),
    ensureChatSession({
      processInstanceId: instanceId,
      authUserId,
      phoneNumberId,
    }),
    loadPricing(scope.instance),
  ]).then(([draftRow, , pricingValue]) => [draftRow, pricingValue] as const);
  const candidates = await Promise.all(
    codes.map(async (code) => ({
      code,
      proposal: await getBallotProposalByCode({
        instance: scope.instance,
        taxonomyTermId: scope.taxonomyTermId,
        code,
      }),
    })),
  );
  const candidateIds = candidates.flatMap(({ proposal }) =>
    proposal ? [proposal.id] : [],
  );
  const { picks: kept, rows } = await loadDraftPicks(draft, candidateIds);
  const costs = await priceRows(rows, pricing);
  const rowById = new Map(rows.map((row) => [row.id, row]));

  const picks = [...kept];
  const results: SmsPickResult[] = [];
  for (const { code, proposal } of candidates) {
    const row = proposal ? rowById.get(proposal.id) : undefined;
    if (!proposal || !row) {
      results.push({ status: 'unknown', code });
      continue;
    }
    const pick = {
      id: row.id,
      code: row.code,
      title: row.title,
      cost: costs.get(row.id) ?? null,
    };
    const existing = picks.indexOf(row.id);
    if (existing !== -1) {
      results.push({ status: 'duplicate', position: existing + 1, pick });
      continue;
    }
    if (pricing.maxPicks !== null && picks.length >= pricing.maxPicks) {
      results.push({ status: 'limit_reached', pick, limit: pricing.maxPicks });
      continue;
    }
    const allocated = sumAmounts(picks.map((id) => costs.get(id) ?? 0));
    if (
      pricing.budget !== null &&
      pick.cost !== null &&
      !isAtMost({
        amount: sumAmounts([allocated, pick.cost]),
        limit: pricing.budget,
      })
    ) {
      results.push({
        status: 'over_budget',
        pick,
        remaining: sumAmounts([pricing.budget, -allocated]),
      });
      continue;
    }
    picks.push(row.id);
    results.push({ status: 'added', position: picks.length, pick });
  }

  if (picks.length !== kept.length) {
    await savePicks(draft.id, picks);
  }

  return {
    results,
    hadPicks: kept.length > 0,
    summary: summarize(scope, pricing, await loadPickRows(picks), costs),
  };
}

export type SmsPickChange =
  | { status: 'removed' | 'moved'; pick: SmsBallotPick; position: number }
  | { status: 'not_on_ballot'; code: number };

const findPickByCode = async (
  key: BallotKey,
  code: number,
): Promise<{ draftId: string; picks: string[]; index: number } | null> => {
  const draft = await ensureBallotDraft({
    processInstanceId: key.instanceId,
    authUserId: key.authUserId,
  });
  const { picks, rows } = await loadDraftPicks(draft);
  const match = rows.find((row) => row.code === code);
  const index = match ? picks.indexOf(match.id) : -1;
  return index === -1 ? null : { draftId: draft.id, picks, index };
};

export async function removeSmsBallotPick({
  authUserId,
  instanceId,
  code,
}: BallotKey & { code: number }): Promise<{
  change: SmsPickChange;
  summary: SmsBallotSummary;
}> {
  const key = { authUserId, instanceId };
  const scope = await loadBallotScope(key);
  await loadPricing(scope.instance);
  const found = await findPickByCode(key, code);

  if (!found) {
    return {
      change: { status: 'not_on_ballot', code },
      summary: await summarizeSmsBallot(key),
    };
  }

  const [removedId] = found.picks.splice(found.index, 1);
  await savePicks(found.draftId, found.picks);
  const summary = await summarizeSmsBallot(key);
  const [removedRow] = await loadPickRows(removedId ? [removedId] : []);

  return {
    change: {
      status: 'removed',
      position: found.index + 1,
      pick: {
        id: removedId ?? '',
        code,
        title: removedRow?.title ?? '',
        cost: null,
      },
    },
    summary,
  };
}

export async function moveSmsBallotPick({
  authUserId,
  instanceId,
  code,
  position,
}: BallotKey & { code: number; position: number }): Promise<{
  change: SmsPickChange;
  summary: SmsBallotSummary;
}> {
  const key = { authUserId, instanceId };
  const scope = await loadBallotScope(key);
  await loadPricing(scope.instance);
  const found = await findPickByCode(key, code);

  if (!found) {
    return {
      change: { status: 'not_on_ballot', code },
      summary: await summarizeSmsBallot(key),
    };
  }

  const target = Math.min(Math.max(position, 1), found.picks.length) - 1;
  const [movedId] = found.picks.splice(found.index, 1);
  found.picks.splice(target, 0, movedId!);
  await savePicks(found.draftId, found.picks);
  const summary = await summarizeSmsBallot(key);
  const pick = summary.picks[target]!;

  return { change: { status: 'moved', position: target + 1, pick }, summary };
}

const findCastBallot = async ({ authUserId, instanceId }: BallotKey) => {
  const profileId = await getIndividualProfileId(authUserId);
  const existing = await db.query.decisionsVoteSubmissions.findFirst({
    where: { processInstanceId: instanceId, submittedByProfileId: profileId },
    columns: { id: true, voteData: true },
  });
  return existing ?? null;
};

export interface SmsBallotState {
  submitted: boolean;
  draftOpen: boolean;
}

export async function getSmsBallotState(
  key: BallotKey,
): Promise<SmsBallotState> {
  const [cast, draft] = await Promise.all([
    findCastBallot(key),
    findBallotDraft({
      processInstanceId: key.instanceId,
      authUserId: key.authUserId,
    }),
  ]);
  return { submitted: cast !== null, draftOpen: draft !== null };
}

export type SmsBallotReopen =
  | { status: 'reopened'; summary: SmsBallotSummary }
  | { status: 'no_ballot' }
  | { status: 'not_allowed' }
  | { status: 'voting_closed' };

export async function reopenSmsBallot(
  key: BallotKey,
): Promise<SmsBallotReopen> {
  const cast = await findCastBallot(key);

  if (!cast) {
    return { status: 'no_ballot' };
  }

  const decision = await describeEnrolmentDecision({
    instanceId: key.instanceId,
  });

  if (!decision.votingOpen) {
    return { status: 'voting_closed' };
  }

  if (!decision.canEditVotes) {
    return { status: 'not_allowed' };
  }

  await ensureBallotDraft({
    processInstanceId: key.instanceId,
    authUserId: key.authUserId,
  });
  await savePicks(
    key,
    (cast.voteData.selections ?? []).map((selection) => selection.proposalId),
  );

  return { status: 'reopened', summary: await summarizeSmsBallot(key) };
}

export type SmsBallotSubmission =
  | { status: 'submitted' | 'revised'; voteSubmissionId: string }
  | { status: 'already_submitted'; voteSubmissionId: string }
  | { status: 'empty' }
  | { status: 'not_enrolled' }
  | { status: 'outside_district' }
  | { status: 'unavailable' }
  | { status: 'not_allowed' }
  | { status: 'refused'; reason: string };

export async function submitSmsBallot({
  authUserId,
  instanceId,
}: BallotKey): Promise<SmsBallotSubmission> {
  const key = { authUserId, instanceId };
  const [cast, draft] = await Promise.all([
    findCastBallot(key),
    findBallotDraft({ processInstanceId: instanceId, authUserId }),
  ]);

  if (cast && !draft) {
    return { status: 'already_submitted', voteSubmissionId: cast.id };
  }

  const picks = draft ? (await loadDraftPicks(draft)).picks : [];

  if (picks.length === 0) {
    return { status: 'empty' };
  }

  const write = cast ? reviseVote : submitVote;

  try {
    const result = await write({
      data: {
        processInstanceId: instanceId,
        selectedProposalIds: picks,
        authUserId,
      },
      authUserId,
    });
    return {
      status: cast ? 'revised' : 'submitted',
      voteSubmissionId: result.id,
    };
  } catch (error) {
    if (error instanceof VoteRevisionNotAllowedError) {
      return { status: 'not_allowed' };
    }
    if (error instanceof VoterNotEnrolledError) {
      return { status: 'not_enrolled' };
    }
    if (error instanceof VoteOutsideDistrictError) {
      return { status: 'outside_district' };
    }
    if (error instanceof ValidationError) {
      return { status: 'refused', reason: error.message };
    }
    if (error instanceof UnauthorizedError || error instanceof NotFoundError) {
      return { status: 'unavailable' };
    }
    throw error;
  }
}

export async function deleteBallotDraft({
  authUserId,
  instanceId,
}: BallotKey): Promise<void> {
  const profileId = await getIndividualProfileId(authUserId);
  await db
    .delete(decisionsVoteDrafts)
    .where(
      and(
        eq(decisionsVoteDrafts.processInstanceId, instanceId),
        eq(decisionsVoteDrafts.profileId, profileId),
      ),
    );
}

export async function findLatestCastBallotInstance({
  authUserId,
}: {
  authUserId: string;
}): Promise<string | null> {
  const profileId = await getIndividualProfileId(authUserId);
  const [latest] = await db.query.decisionsVoteSubmissions.findMany({
    where: { submittedByProfileId: profileId },
    columns: { processInstanceId: true },
    orderBy: { createdAt: 'desc' },
    limit: 1,
  });
  return latest?.processInstanceId ?? null;
}
