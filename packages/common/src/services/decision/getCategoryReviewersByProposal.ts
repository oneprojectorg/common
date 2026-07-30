import {
  type DbClient,
  and,
  db as defaultDb,
  eq,
  inArray,
  isNull,
  or,
} from '@op/db/client';
import { categoryReviewers, proposalCategories } from '@op/db/schema';

/**
 * System-context resolution of which scoped reviewers cover each proposal, for
 * the `by_category` scope. Returns Map<proposalId, Set<reviewerProfileId>>;
 * proposals with no covering scope row are absent from the map.
 *
 * Runs no access check (generation is a system-context phase transition, not a
 * user action). Callers MUST still intersect with getEligibleReviewerProfileIds
 * — a scope row alone grants nothing (fail-closed). Scope rows resolve
 * instance-wide (`phaseId IS NULL`) unioned with rows for this review phase.
 *
 * The optional `db` client lets the reconciler run this join inside the same
 * transaction that just mutated `proposalCategories`, so it reads the new
 * category set rather than the committed one.
 */
export async function getCategoryReviewersByProposal({
  instanceId,
  phaseId,
  proposalIds,
  db = defaultDb,
}: {
  instanceId: string;
  phaseId: string;
  proposalIds: string[];
  db?: DbClient;
}): Promise<Map<string, Set<string>>> {
  const reviewersByProposalId = new Map<string, Set<string>>();

  if (proposalIds.length === 0) {
    return reviewersByProposalId;
  }

  const rows = await db
    .select({
      proposalId: proposalCategories.proposalId,
      reviewerProfileId: categoryReviewers.reviewerProfileId,
    })
    .from(categoryReviewers)
    .innerJoin(
      proposalCategories,
      eq(proposalCategories.taxonomyTermId, categoryReviewers.taxonomyTermId),
    )
    .where(
      and(
        eq(categoryReviewers.processInstanceId, instanceId),
        or(
          isNull(categoryReviewers.phaseId),
          eq(categoryReviewers.phaseId, phaseId),
        ),
        inArray(proposalCategories.proposalId, proposalIds),
      ),
    );

  for (const row of rows) {
    const bucket =
      reviewersByProposalId.get(row.proposalId) ?? new Set<string>();
    bucket.add(row.reviewerProfileId);
    reviewersByProposalId.set(row.proposalId, bucket);
  }

  return reviewersByProposalId;
}
