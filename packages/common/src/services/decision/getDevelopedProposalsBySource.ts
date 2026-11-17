import { db } from '@op/db/client';
import { ProposalRelationshipType } from '@op/db/schema';

import {
  type ProposalReadContext,
  isProposalReadable,
} from './proposalVisibility';
import {
  type DevelopedProposal,
  developedProposalSchema,
} from './schemas/developSources';

/**
 * The entries developed from each source that the caller may read, keyed by
 * source id, oldest edge first. One query for the whole page. A source with no
 * readable entry has no key.
 *
 * Readability is `getProposal`'s gate (`isProposalReadable`): a draft only for
 * members of the entry's own profile, a hidden or flagged entry also for an
 * instance admin.
 */
export async function getDevelopedProposalsBySource({
  processInstanceId,
  sourceProposalIds,
  readContext,
}: {
  processInstanceId: string;
  sourceProposalIds: string[];
  readContext: ProposalReadContext;
}): Promise<Map<string, DevelopedProposal[]>> {
  const bySource = new Map<string, DevelopedProposal[]>();
  if (sourceProposalIds.length === 0) {
    return bySource;
  }

  const edges = await db.query.proposalRelationships.findMany({
    where: {
      processInstanceId,
      sourceProposalId: { in: sourceProposalIds },
      relationshipType: ProposalRelationshipType.DEVELOPED,
      deletedAt: { isNull: true },
      targetProposal: {
        RAW: (table) => isProposalReadable(table, readContext),
      },
    },
    columns: { sourceProposalId: true },
    with: {
      targetProposal: { columns: { id: true, profileId: true, status: true } },
    },
    orderBy: { sourceProposalId: 'asc', createdAt: 'asc', id: 'asc' },
  });

  for (const { sourceProposalId, targetProposal } of edges) {
    // The status column types as `string`; the parse narrows it to the enum.
    const entry = developedProposalSchema.parse(targetProposal);
    const entries = bySource.get(sourceProposalId);
    if (entries) {
      entries.push(entry);
    } else {
      bySource.set(sourceProposalId, [entry]);
    }
  }

  return bySource;
}
