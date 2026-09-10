import type { DbClient } from '@op/db/client';
import { proposalHistory } from '@op/db/schema';
import { and, eq, sql } from 'drizzle-orm';

import { CommonError } from '../../../utils';

/** The open history row the AFTER UPDATE trigger just wrote; call it inside the same transaction as the proposal update. */
export async function findOpenProposalHistoryId(
  tx: DbClient,
  proposalId: string,
): Promise<string> {
  const [historyRecord] = await tx
    .select({ historyId: proposalHistory.historyId })
    .from(proposalHistory)
    .where(
      and(
        eq(proposalHistory.id, proposalId),
        sql`upper(${proposalHistory.validDuring}) IS NULL`,
      ),
    )
    .limit(1);

  if (!historyRecord) {
    throw new CommonError('Failed to find proposal history snapshot');
  }

  return historyRecord.historyId;
}
