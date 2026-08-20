import { db, eq, inArray } from '@op/db/client';
import { proposalCategories, taxonomies, taxonomyTerms } from '@op/db/schema';

/**
 * Shared setup for tests that drive decision categories through the real
 * `ensureProposalTaxonomyTerms` path. Category labels key a *global*,
 * slug-derived `taxonomyTerms` row, so concurrent tests contend on one taxonomy
 * and must both isolate their labels and clean up the terms they mint.
 */

/**
 * Derives a short alphanumeric suffix from the vitest task id so category
 * labels (and therefore their taxonomy `termUri`s) stay unique across the
 * concurrently-running tests that share the global `proposal` taxonomy.
 */
export function labelSuffix(taskId: string): string {
  return taskId.replace(/[^a-z0-9]/gi, '').slice(-8) || 'x';
}

/**
 * Ensures the shared `proposal` taxonomy row exists before any category is
 * defined. The real `ensureProposalTaxonomyTerms` does a find-then-insert that
 * is not concurrency-safe, so two tests defining their first category at once
 * would otherwise collide on `taxonomies_name_unique`. `onConflictDoNothing`
 * lets every concurrent test converge on the same row. (`taxonomies` is exempt
 * from the teardown empty-table check, so the row is left behind.)
 */
export async function ensureProposalTaxonomy(): Promise<void> {
  await db
    .insert(taxonomies)
    .values({ name: 'proposal' })
    .onConflictDoNothing({ target: taxonomies.name });
}

/**
 * Deletes any taxonomy terms created for the given labels once the test
 * finishes. Terms live in the global (non-seeded) `taxonomy_terms` table, which
 * the teardown requires to be empty, and they aren't tied to a profile so the
 * TestDecisionsDataManager cascade never reaches them. Dependent
 * `proposalCategories` rows are cleared first so the delete can't hit an FK.
 */
export function cleanupTermsByLabel(
  labels: string[],
  onTestFinished: (fn: () => void | Promise<void>) => void,
): void {
  onTestFinished(async () => {
    const terms = await db
      .select({ id: taxonomyTerms.id })
      .from(taxonomyTerms)
      .where(inArray(taxonomyTerms.label, labels));
    const ids = terms.map((t) => t.id);
    if (ids.length === 0) {
      return;
    }
    await db
      .delete(proposalCategories)
      .where(inArray(proposalCategories.taxonomyTermId, ids));
    await db.delete(taxonomyTerms).where(inArray(taxonomyTerms.id, ids));
  });
}

/** The taxonomy term ids a proposal's `proposalCategories` rows point at. */
export async function linkedTermIds(proposalId: string): Promise<string[]> {
  const rows = await db
    .select({ taxonomyTermId: proposalCategories.taxonomyTermId })
    .from(proposalCategories)
    .where(eq(proposalCategories.proposalId, proposalId));
  return rows.map((r) => r.taxonomyTermId);
}
