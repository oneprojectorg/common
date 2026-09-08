import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  cleanupTermsByLabel,
  ensureProposalTaxonomy,
  labelSuffix,
} from '../../../test/helpers/categoryTaxonomyTestUtils';
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
