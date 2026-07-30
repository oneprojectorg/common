import { db, inArray } from '@op/db/client';
import { taxonomies, taxonomyTerms } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

/**
 * Derives a short alphanumeric suffix from the vitest task id so category
 * labels (and therefore their taxonomy `termUri`s) stay unique across the
 * concurrently-running tests that share the global `proposal` taxonomy.
 */
function labelSuffix(taskId: string): string {
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
async function ensureProposalTaxonomy(): Promise<void> {
  await db
    .insert(taxonomies)
    .values({ name: 'proposal' })
    .onConflictDoNothing({ target: taxonomies.name });
}

/**
 * Deletes any taxonomy terms created for the given labels once the test
 * finishes. Terms live in the global (non-seeded) `taxonomy_terms` table, which
 * the teardown requires to be empty, and they aren't tied to a profile so the
 * TestDecisionsDataManager cascade never reaches them.
 */
function cleanupTermsByLabel(
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
    await db.delete(taxonomyTerms).where(inArray(taxonomyTerms.id, ids));
  });
}

/**
 * Regression for the slugification half of "Renaming a category ... orphans
 * existing proposal links" (Asana 1216981737476857): term creation and term
 * lookup must derive `termUri` the same way. Term creation uses the `slugify`
 * lib (accent-folding), while `getProcessCategories` used to hand-roll a regex
 * that stripped accented chars instead — so a category could exist yet resolve
 * to nothing. Both now share `categoryTermUri`.
 */
describe.concurrent('category slug parity between creation and lookup', () => {
  it('resolves categories whose labels contain accented characters', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const suffix = labelSuffix(task.id);
    const accentedLabel = `Café ${suffix}`;
    cleanupTermsByLabel([accentedLabel], onTestFinished);
    await ensureProposalTaxonomy();

    // Term creation slugifies "Café" -> "cafe".
    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      config: {
        categories: [
          { id: 'cat-1', label: accentedLabel, description: 'Café proposals' },
        ],
      },
    });

    const result = await caller.decision.getCategories({
      processInstanceId: instance.instance.id,
    });

    // Lookup now slugifies the same way, so the "cafe" term is found.
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0]!.name).toBe(accentedLabel);
    expect(result.categories[0]!.termUri).toBe(`cafe-${suffix.toLowerCase()}`);
  });

  it('resolves categories whose labels contain an ampersand', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const suffix = labelSuffix(task.id);
    const ampersandLabel = `Arts & Culture ${suffix}`;
    cleanupTermsByLabel([ampersandLabel], onTestFinished);
    await ensureProposalTaxonomy();

    // slugify folds "&" to "and"; the old hand-rolled regex dropped it,
    // producing "arts--culture" and a lookup miss.
    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      config: {
        categories: [
          {
            id: 'cat-1',
            label: ampersandLabel,
            description: 'Arts and culture proposals',
          },
        ],
      },
    });

    const result = await caller.decision.getCategories({
      processInstanceId: instance.instance.id,
    });

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0]!.name).toBe(ampersandLabel);
    expect(result.categories[0]!.termUri).toBe(
      `arts-and-culture-${suffix.toLowerCase()}`,
    );
  });
});
