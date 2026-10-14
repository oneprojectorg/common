import { and, asc, db, eq, isNull } from '@op/db/client';
import { profiles, proposals } from '@op/db/schema';

import { DEFAULT_MONEY_CURRENCY } from '../../money';
import { normalizeBudget } from './proposalDataSchema';
import { buildSmsBallotProposalFilter } from './smsBallotScope';

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
  const budget = normalizeBudget(isRecord(data) ? data.budget : undefined);
  return {
    cost: budget?.amount ?? null,
    currency: budget?.currency ?? DEFAULT_MONEY_CURRENCY,
  };
};

const readSummary = (data: unknown): string | null => {
  const summary = isRecord(data) ? data.summary : undefined;
  return typeof summary === 'string' && summary.trim().length > 0
    ? summary.trim()
    : null;
};

const readCodes = async (
  processInstanceId: string,
): Promise<Map<string, string>> => {
  const rows = await db
    .select({ id: proposals.id })
    .from(proposals)
    .where(
      and(
        eq(proposals.processInstanceId, processInstanceId),
        isNull(proposals.deletedAt),
      ),
    )
    .orderBy(asc(proposals.createdAt), asc(proposals.id));

  return new Map(
    rows.map((row, index) => [row.id, String(SMS_PROPOSAL_FIRST_CODE + index)]),
  );
};

export async function listSmsBallotProposals({
  processInstanceId,
}: {
  processInstanceId: string;
}): Promise<Array<SmsBallotProposal>> {
  const filter = await buildSmsBallotProposalFilter({ processInstanceId });

  if (!filter) {
    return [];
  }

  const [codes, rows] = await Promise.all([
    readCodes(processInstanceId),
    db
      .select({
        id: proposals.id,
        title: profiles.name,
        proposalData: proposals.proposalData,
      })
      .from(proposals)
      .innerJoin(profiles, eq(profiles.id, proposals.profileId))
      .where(filter)
      .orderBy(asc(proposals.createdAt), asc(proposals.id)),
  ]);

  return rows.flatMap((row) => {
    const code = codes.get(row.id);
    return code
      ? [
          {
            code,
            proposalId: row.id,
            title: row.title,
            ...readCost(row.proposalData),
            summary: readSummary(row.proposalData),
          },
        ]
      : [];
  });
}
