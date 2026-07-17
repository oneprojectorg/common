import { type DbClient, and, eq, inArray } from '@op/db/client';
import { proposalCategories, taxonomies, taxonomyTerms } from '@op/db/schema';
import { logger } from '@op/logging';

/**
 * Replaces a proposal's category links with the given labels: clears all
 * existing `proposalCategories`, then re-adds one per label by matching
 * `taxonomyTerms.label` within the `proposal` taxonomy. Unmatched labels are
 * warned and skipped. Must run inside the proposal write transaction (`tx`).
 *
 * Because it clears then re-adds, the caller passes the proposal's full category
 * set (manual selections plus any boundary-derived district) — there is no
 * separate boundary-tagging pass.
 */
export async function setProposalCategories({
  tx,
  proposalId,
  labels,
}: {
  tx: DbClient;
  proposalId: string;
  labels: string[];
}): Promise<void> {
  await tx
    .delete(proposalCategories)
    .where(eq(proposalCategories.proposalId, proposalId));

  // Dedupe + drop blanks up front so the lookup and the insert stay in sync.
  const trimmedLabels = [
    ...new Set(labels.map((label) => label.trim()).filter(Boolean)),
  ];

  if (trimmedLabels.length === 0) {
    return;
  }

  const proposalTaxonomy = await tx._query.taxonomies.findFirst({
    where: eq(taxonomies.name, 'proposal'),
  });

  if (!proposalTaxonomy) {
    logger.warn('No "proposal" taxonomy found, skipping category linking', {
      proposalId,
    });
    return;
  }

  // One query for all labels instead of a findFirst per label (the old N+1 held
  // the write transaction open across N sequential round-trips).
  const terms = await tx._query.taxonomyTerms.findMany({
    where: and(
      inArray(taxonomyTerms.label, trimmedLabels),
      eq(taxonomyTerms.taxonomyId, proposalTaxonomy.id),
    ),
  });

  const termIdByLabel = new Map(terms.map((term) => [term.label, term.id]));

  const taxonomyTermIds: string[] = [];
  for (const label of trimmedLabels) {
    const taxonomyTermId = termIdByLabel.get(label);
    if (!taxonomyTermId) {
      logger.warn('No taxonomy term found for category', { proposalId, label });
      continue;
    }
    taxonomyTermIds.push(taxonomyTermId);
  }

  if (taxonomyTermIds.length > 0) {
    await tx.insert(proposalCategories).values(
      taxonomyTermIds.map((taxonomyTermId) => ({
        proposalId,
        taxonomyTermId,
      })),
    );
  }
}
