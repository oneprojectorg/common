import { db, eq } from '@op/db/client';
import { taxonomies, taxonomyTerms } from '@op/db/schema';
import slugify from 'slugify';

import { CommonError } from '../../utils';

/**
 * Ensures the proposal taxonomy exists and that each category label has a
 * matching taxonomy term.
 */
export async function ensureProposalTaxonomy(
  categories: string[],
): Promise<string[]> {
  if (!categories || categories.length === 0) {
    return [];
  }

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

  const taxonomyTermIds: string[] = [];

  for (const categoryName of categories) {
    if (!categoryName.trim()) {
      continue;
    }

    const categoryLabel = categoryName.trim();
    const termUri = slugify(categoryLabel, {
      lower: true,
      strict: true,
      trim: true,
    });

    let existingTerm = await db._query.taxonomyTerms.findFirst({
      where: eq(taxonomyTerms.termUri, termUri),
    });

    if (!existingTerm) {
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
