import { and, db, eq, inArray } from '@op/db/client';
import { decisionBallotDrafts, profiles, proposals } from '@op/db/schema';
import type { AmountUnit } from '@op/types/amountUnit';

import {
  ValidationError,
  VoteOutsideDistrictError,
  VoterNotEnrolledError,
} from '../../../utils';
import { getIndividualProfileId } from '../../access';
import { ensureBallotDraft } from '../ballotDraft';
import { getFieldUnit, isAtMost, sumAmounts } from '../fieldUnit';
import { getBallotProposalByCode } from '../getBallotProposalByCode';
import { getProposalCosts } from '../getProposalCosts';
import { resolveProposalTemplate } from '../resolveProposalTemplate';
import type { DecisionInstanceData } from '../schemas/instanceData';
import { getVoterBudget, getVoterCostField } from '../utils/phaseSettings';
import { submitVote } from '../voting';
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
  const phase = (instance.instanceData as DecisionInstanceData).phases?.find(
    (candidate) => candidate.phaseId === instance.currentStateId,
  );
  const budget = phase ? getVoterBudget(phase) : undefined;
  const voterCostField = phase ? getVoterCostField(phase) : 'budget';
  const proposalTemplate = await resolveProposalTemplate(
    instance.instanceData as Record<string, unknown> | null,
    instance.processId,
  );
  const unit = getFieldUnit(proposalTemplate?.properties?.[voterCostField]);

  return { budget: budget ?? null, voterCostField, proposalTemplate, unit };
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
    .where(inArray(proposals.id, ids));
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
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
  const rows = await loadPickRows(draft.picks);
  const costs = await priceRows(rows, pricing);

  return summarize(scope, pricing, rows, costs);
}

export type SmsPickResult =
  | { status: 'added'; position: number; pick: SmsBallotPick }
  | { status: 'duplicate'; position: number; pick: SmsBallotPick }
  | { status: 'over_budget'; pick: SmsBallotPick; remaining: number }
  | { status: 'unknown'; code: number };

const savePicks = async (key: BallotKey, picks: string[]): Promise<void> => {
  const profileId = await getIndividualProfileId(key.authUserId);
  await db
    .update(decisionBallotDrafts)
    .set({ picks, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(decisionBallotDrafts.processInstanceId, key.instanceId),
        eq(decisionBallotDrafts.profileId, profileId),
      ),
    );
};

export async function addSmsBallotPicks({
  authUserId,
  instanceId,
  codes,
}: BallotKey & { codes: number[] }): Promise<{
  results: SmsPickResult[];
  summary: SmsBallotSummary;
  hadPicks: boolean;
}> {
  const key = { authUserId, instanceId };
  const scope = await loadBallotScope(key);
  const [draft, pricing] = await Promise.all([
    ensureBallotDraft({ processInstanceId: instanceId, authUserId }),
    loadPricing(scope.instance),
  ]);
  const candidates = await Promise.all(
    codes.map(async (code) => ({
      code,
      proposal: await getBallotProposalByCode({
        instance: scope.instance,
        boundaryId: scope.boundaryId,
        code,
      }),
    })),
  );
  const candidateIds = candidates.flatMap(({ proposal }) =>
    proposal ? [proposal.id] : [],
  );
  const rows = await loadPickRows([...draft.picks, ...candidateIds]);
  const costs = await priceRows(rows, pricing);
  const rowById = new Map(rows.map((row) => [row.id, row]));

  const picks = [...draft.picks];
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

  if (picks.length !== draft.picks.length) {
    await savePicks(key, picks);
  }

  return {
    results,
    hadPicks: draft.picks.length > 0,
    summary: summarize(scope, pricing, await loadPickRows(picks), costs),
  };
}

export type SmsPickChange =
  | { status: 'removed' | 'moved'; pick: SmsBallotPick; position: number }
  | { status: 'not_on_ballot'; code: number };

const findPickByCode = async (
  key: BallotKey,
  code: number,
): Promise<{ picks: string[]; index: number } | null> => {
  const draft = await ensureBallotDraft({
    processInstanceId: key.instanceId,
    authUserId: key.authUserId,
  });
  const rows = await loadPickRows(draft.picks);
  const index = rows.findIndex((row) => row.code === code);
  return index === -1 ? null : { picks: [...draft.picks], index };
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
  const found = await findPickByCode(key, code);

  if (!found) {
    return {
      change: { status: 'not_on_ballot', code },
      summary: await summarizeSmsBallot(key),
    };
  }

  const [removedId] = found.picks.splice(found.index, 1);
  await savePicks(key, found.picks);
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
  await savePicks(key, found.picks);
  const summary = await summarizeSmsBallot(key);
  const pick = summary.picks[target]!;

  return { change: { status: 'moved', position: target + 1, pick }, summary };
}

export type SmsBallotSubmission =
  | { status: 'submitted'; voteSubmissionId: string }
  | { status: 'already_submitted' }
  | { status: 'empty' }
  | { status: 'not_enrolled' }
  | { status: 'outside_district' }
  | { status: 'refused'; reason: string };

export async function submitSmsBallot({
  authUserId,
  instanceId,
}: BallotKey): Promise<SmsBallotSubmission> {
  const profileId = await getIndividualProfileId(authUserId);
  const existing = await db.query.decisionsVoteSubmissions.findFirst({
    where: { processInstanceId: instanceId, submittedByProfileId: profileId },
    columns: { id: true },
  });

  if (existing) {
    return { status: 'already_submitted' };
  }

  const draft = await ensureBallotDraft({
    processInstanceId: instanceId,
    authUserId,
  });

  if (draft.picks.length === 0) {
    return { status: 'empty' };
  }

  try {
    const result = await submitVote({
      data: {
        processInstanceId: instanceId,
        selectedProposalIds: draft.picks,
        authUserId,
      },
      authUserId,
    });
    await db
      .delete(decisionBallotDrafts)
      .where(eq(decisionBallotDrafts.id, draft.id));
    return { status: 'submitted', voteSubmissionId: result.id };
  } catch (error) {
    if (error instanceof VoterNotEnrolledError) {
      return { status: 'not_enrolled' };
    }
    if (error instanceof VoteOutsideDistrictError) {
      return { status: 'outside_district' };
    }
    if (error instanceof ValidationError) {
      return { status: 'refused', reason: error.message };
    }
    throw error;
  }
}
