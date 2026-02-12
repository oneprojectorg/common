import { db, eq } from '@op/db/client';
import { taxonomies, taxonomyTerms } from '@op/db/schema';

import { CommonError } from '../../../utils';

/**
 * Finds or creates a taxonomy term for a proposal category.
 * Ensures the "proposal" taxonomy exists, then looks up the term by label.
 * If the term doesn't exist, creates it with a normalized URI.
 *
 * Returns the taxonomyTermId, or null if the label is empty/whitespace.
 */
export async function ensureProposalTaxonomyTerm(
  categoryLabel: string,
): Promise<string | null> {
  const trimmed = categoryLabel?.trim();
  if (!trimmed) {
    return null;
  }

  // Ensure "proposal" taxonomy exists
  let proposalTaxonomy = await db._query.taxonomies.findFirst({
    where: eq(taxonomies.name, 'proposal'),
  });

  if (!proposalTaxonomy) {
    const [newTaxonomy] = await db
      .insert(taxonomies)
      .values({
        name: 'proposal',
        description:
          'Categories for organizing proposals in decision-making processes',
      })
      .returning();

    if (!newTaxonomy) {
      throw new CommonError('Failed to create proposal taxonomy');
    }
    proposalTaxonomy = newTaxonomy;
  }

  // Look up existing term by label within the proposal taxonomy
  const existingTerm = await db._query.taxonomyTerms.findFirst({
    where: eq(taxonomyTerms.label, trimmed),
    with: {
      taxonomy: true,
    },
  });

  if (existingTerm && existingTerm.taxonomy?.name === 'proposal') {
    return existingTerm.id;
  }

  // Create a new term
  const termUri = trimmed
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  const [newTerm] = await db
    .insert(taxonomyTerms)
    .values({
      taxonomyId: proposalTaxonomy.id,
      termUri,
      label: trimmed,
      definition: `Category for ${trimmed} proposals`,
    })
    .returning();

  if (!newTerm) {
    throw new CommonError(
      `Failed to create taxonomy term for category: ${trimmed}`,
    );
  }

  return newTerm.id;
}
