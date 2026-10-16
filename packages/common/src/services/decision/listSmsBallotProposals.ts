import { and, asc, db, eq, isNull, sql } from '@op/db/client';
import { processInstances, profiles, proposals } from '@op/db/schema';

import { DEFAULT_MONEY_CURRENCY } from '../../money';
import { parseProposalData } from './proposalDataSchema';
import { buildSmsBallotProposalFilter } from './smsBallotScope';

export interface SmsBallotProposal {
  code: string;
  proposalId: string;
  title: string;
  cost: number | null;
  currency: string;
  summary: string | null;
}

const readSummary = (summary: unknown): string | null =>
  typeof summary === 'string' && summary.trim().length > 0
    ? summary.trim()
    : null;

export const assignShortCodes = async (
  processInstanceId: string,
): Promise<void> => {
  await db.transaction(async (tx) => {
    await tx
      .select({ id: processInstances.id })
      .from(processInstances)
      .where(eq(processInstances.id, processInstanceId))
      .for('update');

    const uncoded = await tx
      .select({ id: proposals.id })
      .from(proposals)
      .where(
        and(
          eq(proposals.processInstanceId, processInstanceId),
          isNull(proposals.shortCode),
        ),
      )
      .orderBy(asc(proposals.createdAt), asc(proposals.id));

    for (const proposal of uncoded) {
      const [reserved] = await tx
        .update(processInstances)
        .set({ nextShortCode: sql`${processInstances.nextShortCode} + 1` })
        .where(eq(processInstances.id, processInstanceId))
        .returning({ next: processInstances.nextShortCode });
      if (!reserved) {
        return;
      }
      await tx
        .update(proposals)
        .set({ shortCode: reserved.next - 1 })
        .where(eq(proposals.id, proposal.id));
    }
  });
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

  await assignShortCodes(processInstanceId);

  const rows = await db
    .select({
      id: proposals.id,
      shortCode: proposals.shortCode,
      title: profiles.name,
      proposalData: proposals.proposalData,
    })
    .from(proposals)
    .innerJoin(profiles, eq(profiles.id, proposals.profileId))
    .where(filter)
    .orderBy(asc(proposals.shortCode));

  return rows.flatMap((row) => {
    if (row.shortCode === null) {
      return [];
    }
    const data = parseProposalData(row.proposalData);
    return [
      {
        code: String(row.shortCode),
        proposalId: row.id,
        title: row.title,
        cost: data.budget?.amount ?? null,
        currency: data.budget?.currency ?? DEFAULT_MONEY_CURRENCY,
        summary: readSummary(data.summary),
      },
    ];
  });
}
