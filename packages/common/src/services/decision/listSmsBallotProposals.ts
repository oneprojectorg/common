import { and, asc, db, eq, isNull } from '@op/db/client';
import { profiles, proposals } from '@op/db/schema';

import { isVotingEligible } from './votingEligibility';

export const SMS_PROPOSAL_FIRST_CODE = 101;

export interface SmsBallotProposal {
  code: string;
  proposalId: string;
  title: string;
  cost: number | null;
  currency: string;
  summary: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readCost = (data: unknown): { cost: number | null; currency: string } => {
  const budget = isRecord(data) ? data.budget : undefined;
  if (typeof budget === 'number') {
    return { cost: budget, currency: 'USD' };
  }
  if (isRecord(budget)) {
    return {
      cost: typeof budget.amount === 'number' ? budget.amount : null,
      currency: typeof budget.currency === 'string' ? budget.currency : 'USD',
    };
  }
  return { cost: null, currency: 'USD' };
};

const readSummary = (data: unknown): string | null => {
  const summary = isRecord(data) ? data.summary : undefined;
  return typeof summary === 'string' && summary.trim().length > 0
    ? summary.trim()
    : null;
};

export async function listSmsBallotProposals({
  processInstanceId,
}: {
  processInstanceId: string;
}): Promise<Array<SmsBallotProposal>> {
  const rows = await db
    .select({
      id: proposals.id,
      status: proposals.status,
      title: profiles.name,
      proposalData: proposals.proposalData,
    })
    .from(proposals)
    .innerJoin(profiles, eq(profiles.id, proposals.profileId))
    .where(
      and(
        eq(proposals.processInstanceId, processInstanceId),
        isNull(proposals.deletedAt),
        isNull(proposals.moderationDetachedAt),
      ),
    )
    .orderBy(asc(proposals.createdAt), asc(proposals.id));

  return rows
    .filter((row) => isVotingEligible(row.status))
    .map((row, index) => ({
      code: String(SMS_PROPOSAL_FIRST_CODE + index),
      proposalId: row.id,
      title: row.title,
      ...readCost(row.proposalData),
      summary: readSummary(row.proposalData),
    }));
}
