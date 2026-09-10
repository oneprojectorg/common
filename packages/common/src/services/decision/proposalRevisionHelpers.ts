import { invalidateCachedDocumentFragments } from '@op/collab';
import type { DbClient } from '@op/db/client';
import { proposalHistory } from '@op/db/schema';
import { waitUntil } from '@vercel/functions';
import { and, eq, sql } from 'drizzle-orm';

import { CommonError } from '../../utils';
import { getProposalFragmentNames } from './getProposalFragmentNames';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import type { DecisionInstanceData } from './schemas/instanceData';

/**
 * The snapshot the AFTER UPDATE trigger on `decision_proposals` just wrote —
 * the one history row whose validity range is still open. Call it inside the
 * same transaction as the proposal update.
 */
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

/**
 * Evicts the superseded version's cached fragments after a resubmission.
 * Best-effort and non-blocking — the version-keyed cache would also rotate
 * naturally on the next read, but active eviction keeps Redis memory from
 * accreting orphaned entries.
 */
export async function evictPriorProposalVersionCache({
  collaborationDocId,
  instance,
  priorVersionId,
}: {
  collaborationDocId: string;
  instance: { instanceData: unknown; processId: string };
  priorVersionId: number | undefined;
}): Promise<void> {
  if (priorVersionId === undefined) {
    return;
  }

  const proposalTemplate = await resolveProposalTemplate(
    instance.instanceData as DecisionInstanceData | null,
    instance.processId,
  );
  const fragmentNames = proposalTemplate
    ? getProposalFragmentNames(proposalTemplate)
    : ['default'];

  waitUntil(
    invalidateCachedDocumentFragments({
      docId: collaborationDocId,
      versionId: priorVersionId,
      fragmentNames,
    }),
  );
}
