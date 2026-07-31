import { db, eq } from '@op/db/client';
import { taxonomies, taxonomyTerms } from '@op/db/schema';
import slugify from 'slugify';

import { CommonError } from '../../utils';
import { linkBoundaryToCategoryTerm } from './linkBoundaryToCategory';

/**
 * Canonical label → `taxonomyTerms.termUri` slug. This is the single join key
 * between a config category label and its global taxonomy term, so term
 * creation ({@link ensureProposalTaxonomyTerms}) and every lookup
 * ({@link getProcessCategories}, rename reconciliation) MUST derive the slug
 * the same way — otherwise a term can exist but resolve to nothing (e.g.
 * "Café" folds to "cafe" here, but a hand-rolled regex would strip it to
 * "caf").
 */
export const categoryTermUri = (label: string): string =>
  slugify(label.trim(), { lower: true, strict: true, trim: true });

/**
 * Ensures the proposal taxonomy exists and that each category label has a
 * matching taxonomy term.
 */
export async function ensureProposalTaxonomyTerms(
  categories: string[],
): Promise<string[]> {
  if (!categories || categories.length === 0) {
    return [];
  }

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

  const taxonomyTermIds: string[] = [];

  for (const categoryName of categories) {
    if (!categoryName.trim()) {
      continue;
    }

    const categoryLabel = categoryName.trim();
    const termUri = categoryTermUri(categoryLabel);

    // taxonomyTerms V2 types are broken due to self-referential parentId
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
      // If a boundary was imported with this category's name, link it now so
      // the boundary auto-tags proposals once the category is in use.
      await linkBoundaryToCategoryTerm(db, existingTerm.id, categoryLabel);
    }
  }

  return taxonomyTermIds;
}
