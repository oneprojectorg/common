import { type DbClient, and, eq } from '@op/db/client';
import { proposalCategories, taxonomies, taxonomyTerms } from '@op/db/schema';

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
export async function setProposalCategories(
  tx: DbClient,
  proposalId: string,
  labels: string[],
): Promise<void> {
  await tx
    .delete(proposalCategories)
    .where(eq(proposalCategories.proposalId, proposalId));

  if (labels.length === 0) {
    return;
  }

  const proposalTaxonomy = await tx._query.taxonomies.findFirst({
    where: eq(taxonomies.name, 'proposal'),
  });

  if (!proposalTaxonomy) {
    console.warn('No "proposal" taxonomy found, skipping category linking');
    return;
  }

  const taxonomyTermIds: string[] = [];

  for (const label of labels) {
    if (!label.trim()) {
      continue;
    }

    const taxonomyTerm = await tx._query.taxonomyTerms.findFirst({
      where: and(
        eq(taxonomyTerms.label, label.trim()),
        eq(taxonomyTerms.taxonomyId, proposalTaxonomy.id),
      ),
    });

    if (!taxonomyTerm) {
      console.warn(`No taxonomy term found for category: ${label}`);
      continue;
    }

    taxonomyTermIds.push(taxonomyTerm.id);
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
