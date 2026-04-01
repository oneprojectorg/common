import { and, db, eq, inArray } from '@op/db/client';
import { taxonomies, taxonomyTerms } from '@op/db/schema';
import type { TransactionType } from '@op/db/client';

import { CommonError } from '../../../utils';

/**
 * Ensures the "proposal" taxonomy exists and creates taxonomy terms for any
 * categories that don't already have a matching term.
 *
 * Returns the IDs of the taxonomy terms that correspond to the given
 * category labels.
 */
export async function ensureProposalTaxonomy(
  categories: string[],
): Promise<string[]> {
  if (categories.length === 0) {
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

  const labels = categories.map((c) => c.trim()).filter(Boolean);
  if (labels.length === 0) {
    return [];
  }

  const termUris = labels.map((label) =>
    label
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, ''),
  );

  const existingTerms = await db._query.taxonomyTerms.findMany({
    where: and(
      eq(taxonomyTerms.taxonomyId, proposalTaxonomy.id),
      inArray(taxonomyTerms.termUri, termUris),
    ),
  });

  const existingUris = new Set(existingTerms.map((t) => t.termUri));

  const toInsert = labels
    .map((label, i) => ({ label, termUri: termUris[i]! }))
    .filter(({ termUri }) => !existingUris.has(termUri));

  if (toInsert.length > 0) {
    const inserted = await db
      .insert(taxonomyTerms)
      .values(
        toInsert.map(({ label, termUri }) => ({
          taxonomyId: proposalTaxonomy.id,
          termUri,
          label,
          definition: `Category for ${label} proposals`,
        })),
      )
      .returning();

    existingTerms.push(...inserted);
  }

  return existingTerms.map((t) => t.id);
}

/**
 * Resolves category labels to their taxonomy term IDs.
 *
 * Unlike `ensureProposalTaxonomy`, this does not create missing terms — it
 * only looks up existing ones. Designed for use when linking proposals to
 * categories that should already exist.
 */
export async function resolveProposalCategoryTermIds(
  categoryLabels: string[],
  txOrDb: TransactionType | typeof db = db,
): Promise<string[]> {
  if (categoryLabels.length === 0) {
    return [];
  }

  const terms = await txOrDb._query.taxonomyTerms.findMany({
    where: inArray(taxonomyTerms.label, categoryLabels),
    with: { taxonomy: true },
  });

  const ids: string[] = [];

  for (const term of terms) {
    if (term.taxonomy?.name === 'proposal') {
      ids.push(term.id);
    }
  }

  if (ids.length < categoryLabels.length) {
    const found = new Set(
      terms.filter((t) => t.taxonomy?.name === 'proposal').map((t) => t.label),
    );
    for (const label of categoryLabels) {
      if (!found.has(label)) {
        console.warn(
          `No valid proposal taxonomy term found for category: ${label}`,
        );
      }
    }
  }

  return ids;
}
