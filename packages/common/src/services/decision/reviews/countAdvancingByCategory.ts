import { and, count, db, eq, exists, isNull } from '@op/db/client';
import {
  ProposalRelationshipType,
  ProposalStatus,
  proposalCategories,
  proposalRelationships,
  proposals,
} from '@op/db/schema';

import { activeProposalPredicate } from '../phaseEligibility';

/** The entries `publishDevelopedProposals` publishes, grouped by category. */
export async function countAdvancingByCategory({
  processInstanceId,
}: {
  processInstanceId: string;
}): Promise<Map<string, number>> {
  const rows = await db
    .select({
      taxonomyTermId: proposalCategories.taxonomyTermId,
      total: count(),
    })
    .from(proposals)
    .innerJoin(
      proposalCategories,
      eq(proposalCategories.proposalId, proposals.id),
    )
    .where(
      and(
        eq(proposals.processInstanceId, processInstanceId),
        eq(proposals.status, ProposalStatus.SUBMITTED),
        activeProposalPredicate(proposals),
        exists(
          db
            .select({ id: proposalRelationships.id })
            .from(proposalRelationships)
            .where(
              and(
                eq(proposalRelationships.processInstanceId, processInstanceId),
                eq(proposalRelationships.targetProposalId, proposals.id),
                eq(
                  proposalRelationships.relationshipType,
                  ProposalRelationshipType.DEVELOPED,
                ),
                isNull(proposalRelationships.deletedAt),
              ),
            ),
        ),
      ),
    )
    .groupBy(proposalCategories.taxonomyTermId);

  return new Map(rows.map((row) => [row.taxonomyTermId, row.total]));
}
