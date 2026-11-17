import { and, db, eq, inArray, isNull } from '@op/db/client';
import {
  ProposalRelationshipType,
  proposalRelationships,
  proposals,
} from '@op/db/schema';

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

  const rows = await db
    .select({
      sourceProposalId: proposalRelationships.sourceProposalId,
      id: proposals.id,
      profileId: proposals.profileId,
      status: proposals.status,
    })
    .from(proposalRelationships)
    // Inner join: the composite foreign key guarantees the target is a
    // proposal in this decision.
    .innerJoin(
      proposals,
      eq(proposals.id, proposalRelationships.targetProposalId),
    )
    .where(
      and(
        eq(proposalRelationships.processInstanceId, processInstanceId),
        inArray(proposalRelationships.sourceProposalId, sourceProposalIds),
        eq(
          proposalRelationships.relationshipType,
          ProposalRelationshipType.DEVELOPED,
        ),
        isNull(proposalRelationships.deletedAt),
        isProposalReadable(proposals, readContext),
      ),
    )
    .orderBy(
      proposalRelationships.sourceProposalId,
      proposalRelationships.createdAt,
      proposalRelationships.id,
    );

  for (const { sourceProposalId, ...row } of rows) {
    // The status column types as `string`; the parse narrows it to the enum.
    const entry = developedProposalSchema.parse(row);
    const entries = bySource.get(sourceProposalId);
    if (entries) {
      entries.push(entry);
    } else {
      bySource.set(sourceProposalId, [entry]);
    }
  }

  return bySource;
}
