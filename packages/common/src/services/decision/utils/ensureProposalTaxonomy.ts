import { db } from '@op/db/client';
import { taxonomies, taxonomyTerms } from '@op/db/schema';

import { CommonError } from '../../../utils';

/**
 * Ensures the "proposal" taxonomy exists and creates/updates taxonomy terms for the given categories
 */
export async function ensureProposalTaxonomy(
  categories: string[],
): Promise<string[]> {
  if (!categories || categories.length === 0) {
    return [];
  }

  // Ensure "proposal" taxonomy exists
  let proposalTaxonomy = await db.query.taxonomies.findFirst({
    where: { name: 'proposal' },
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

  // Process each category
  const taxonomyTermIds: string[] = [];

  for (const categoryName of categories) {
    if (!categoryName.trim()) {
      continue;
    }

    const categoryLabel = categoryName.trim();
    const termUri = categoryLabel
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    // Check if taxonomy term already exists
    let existingTerm = await db.query.taxonomyTerms.findFirst({
      where: { termUri: { eq: termUri } },
    });

    if (!existingTerm) {
      // Create new taxonomy term
      const [newTerm] = await db
        .insert(taxonomyTerms)
        .values({
          taxonomyId: proposalTaxonomy.id,
          termUri,
          label: categoryLabel,
          definition: `Category for ${categoryLabel} proposals`,
        })
        .returning();

      if (!newTerm) {
        throw new CommonError(
          `Failed to create taxonomy term for category: ${categoryLabel}`,
        );
      }
      existingTerm = newTerm;
    }

    if (existingTerm) {
      taxonomyTermIds.push(existingTerm.id);
    }
  }

  return taxonomyTermIds;
}
