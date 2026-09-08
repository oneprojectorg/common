import { db, and, eq } from '@op/db/client';
import { categoryReviewers, proposals } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  cleanupTermsByLabel,
  ensureProposalTaxonomy,
  labelSuffix,
  linkedTermIds,
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

/** The taxonomy term ids a reviewer's scope rows cover in an instance. */
async function scopedTermIds(
  processInstanceId: string,
  reviewerProfileId: string,
): Promise<string[]> {
  const rows = await db
    .select({ taxonomyTermId: categoryReviewers.taxonomyTermId })
    .from(categoryReviewers)
    .where(
      and(
        eq(categoryReviewers.processInstanceId, processInstanceId),
        eq(categoryReviewers.reviewerProfileId, reviewerProfileId),
      ),
    );
  return rows.map((r) => r.taxonomyTermId);
}

/** The category labels stored in a proposal's `proposalData`. */
async function storedCategoryLabels(proposalId: string): Promise<string[]> {
  const row = await db
    .select({ proposalData: proposals.proposalData })
    .from(proposals)
    .where(eq(proposals.id, proposalId));
  const category = (row[0]?.proposalData as { category?: unknown } | null)
    ?.category;
  if (typeof category === 'string') {
    return [category];
  }
  return Array.isArray(category) ? category.filter(isString) : [];
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Regression for "Renaming a category creates a new taxonomy term and orphans
 * existing proposal links" (Asana 1216981737476857).
 *
 * A category has three identities that don't line up: the config-local `id` in
 * `instanceData.config.categories`, the label→slug join key, and the global,
 * slug-keyed `taxonomyTerms` row. Renaming a category makes
 * `ensureProposalTaxonomyTerms` mint a *new* term for the new label, and every
 * holder of the old term has to move with it: `decision_categories` links,
 * `decision_category_reviewers` scope rows, and the `proposalData.category`
 * label copy that `setProposalCategories` resolves against. Moving only a subset
 * trades the orphaned-category bug for a worse one — divergent join keys.
 */
describe.concurrent('category rename reconciles category-keyed rows', () => {
  it('re-points existing proposal category links when a category is renamed', async ({
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
    const originalLabel = `Parks ${suffix}`;
    const renamedLabel = `Parks and Recreation ${suffix}`;
    cleanupTermsByLabel([originalLabel, renamedLabel], onTestFinished);
    await ensureProposalTaxonomy();

    // 1. Admin defines a category in the Process Builder. This runs the real
    //    `ensureProposalTaxonomyTerms`, minting the taxonomy term for "Parks".
    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      config: {
        categories: [
          { id: 'cat-1', label: originalLabel, description: 'Parks proposals' },
        ],
      },
    });

    const before = await caller.decision.getCategories({
      processInstanceId: instance.instance.id,
    });
    expect(before.categories).toHaveLength(1);
    const originalTermId = before.categories[0]!.id;

    // 2. A member tags a proposal with that category. `createProposal` matches
    //    the label to the taxonomy term and writes a `proposalCategories` row.
    const proposal = await caller.decision.createProposal({
      processInstanceId: instance.instance.id,
      proposalData: {
        title: `Fix the playground ${suffix}`,
        category: [originalLabel],
      },
    });
    testData.trackProfileForCleanup(proposal.profileId);

    // Sanity: the proposal is discoverable under the category it was tagged with.
    expect(await linkedTermIds(proposal.id)).toEqual([originalTermId]);
    expect(before.categories.map((c) => c.id)).toContain(originalTermId);

    // 3. Admin renames the category (same config-local `id`, new label).
    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      config: {
        categories: [
          { id: 'cat-1', label: renamedLabel, description: 'Parks proposals' },
        ],
      },
    });

    const after = await caller.decision.getCategories({
      processInstanceId: instance.instance.id,
    });
    expect(after.categories).toHaveLength(1);
    const renamedTermId = after.categories[0]!.id;

    // The rename minted a brand-new term (the root cause of the orphaning).
    expect(renamedTermId).not.toBe(originalTermId);

    // The proposal's link is re-pointed to the renamed term, so it stays
    // discoverable under a category `getCategories` actually returns.
    const links = await linkedTermIds(proposal.id);
    expect(links).toEqual([renamedTermId]);
    expect(after.categories.map((c) => c.id)).toContain(links[0]);
  });

  it("leaves another instance's links untouched when this instance renames a shared category", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Two instances under the same process/org, both using the same category
    // label. Taxonomy terms are global, so both proposals share one term.
    const setup = await testData.createDecisionSetup({
      instanceCount: 2,
      grantAccess: true,
    });
    const [instanceA, instanceB] = setup.instances;
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const suffix = labelSuffix(task.id);
    const sharedLabel = `Housing ${suffix}`;
    const renamedLabel = `Affordable Housing ${suffix}`;
    cleanupTermsByLabel([sharedLabel, renamedLabel], onTestFinished);
    await ensureProposalTaxonomy();

    for (const inst of [instanceA!, instanceB!]) {
      await caller.decision.updateDecisionInstance({
        instanceId: inst.instance.id,
        config: {
          categories: [
            { id: 'cat-1', label: sharedLabel, description: 'Housing' },
          ],
        },
      });
    }

    const sharedCategories = await caller.decision.getCategories({
      processInstanceId: instanceB!.instance.id,
    });
    const sharedTermId = sharedCategories.categories[0]!.id;

    const proposalB = await caller.decision.createProposal({
      processInstanceId: instanceB!.instance.id,
      proposalData: { title: `B proposal ${suffix}`, category: [sharedLabel] },
    });
    testData.trackProfileForCleanup(proposalB.profileId);
    expect(await linkedTermIds(proposalB.id)).toEqual([sharedTermId]);

    // Instance A renames its category — instance B must be unaffected.
    await caller.decision.updateDecisionInstance({
      instanceId: instanceA!.instance.id,
      config: {
        categories: [
          { id: 'cat-1', label: renamedLabel, description: 'Housing' },
        ],
      },
    });

    // B's proposal still points at the original shared term.
    expect(await linkedTermIds(proposalB.id)).toEqual([sharedTermId]);
  });

  it("moves a reviewer's category scope row so coverage survives the rename", async ({
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
    const originalLabel = `Transit ${suffix}`;
    const renamedLabel = `Public Transit ${suffix}`;
    cleanupTermsByLabel([originalLabel, renamedLabel], onTestFinished);
    await ensureProposalTaxonomy();

    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      config: {
        categories: [
          { id: 'cat-1', label: originalLabel, description: 'Transit' },
        ],
      },
    });

    const before = await caller.decision.getCategories({
      processInstanceId: instance.instance.id,
    });
    const originalTermId = before.categories[0]!.id;

    // A reviewer is scoped to the category. `categoryReviewers` keys on the
    // taxonomy term, and `getCategoryReviewersByProposal` joins it directly to
    // `proposalCategories.taxonomyTermId` — so if only the proposal links move,
    // that equi-join stops matching and the reviewer silently loses coverage.
    const reviewer = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    const reviewerProfileId = reviewer.profileId;
    await db.insert(categoryReviewers).values({
      processInstanceId: instance.instance.id,
      taxonomyTermId: originalTermId,
      reviewerProfileId,
      phaseId: null,
    });

    expect(
      await scopedTermIds(instance.instance.id, reviewerProfileId),
    ).toEqual([originalTermId]);

    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      config: {
        categories: [
          { id: 'cat-1', label: renamedLabel, description: 'Transit' },
        ],
      },
    });

    const after = await caller.decision.getCategories({
      processInstanceId: instance.instance.id,
    });
    const renamedTermId = after.categories[0]!.id;
    expect(renamedTermId).not.toBe(originalTermId);

    // The scope row followed the category, so the reviewer still covers it.
    expect(
      await scopedTermIds(instance.instance.id, reviewerProfileId),
    ).toEqual([renamedTermId]);
  });

  it('rewrites the renamed label in proposalData so a later edit cannot undo the re-point', async ({
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
    const originalLabel = `Arts ${suffix}`;
    const renamedLabel = `Arts and Culture ${suffix}`;
    cleanupTermsByLabel([originalLabel, renamedLabel], onTestFinished);
    await ensureProposalTaxonomy();

    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      config: {
        categories: [
          { id: 'cat-1', label: originalLabel, description: 'Arts' },
        ],
      },
    });

    const proposal = await caller.decision.createProposal({
      processInstanceId: instance.instance.id,
      proposalData: {
        title: `Mural program ${suffix}`,
        category: [originalLabel],
      },
    });
    testData.trackProfileForCleanup(proposal.profileId);
    expect(await storedCategoryLabels(proposal.id)).toEqual([originalLabel]);

    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      config: {
        categories: [{ id: 'cat-1', label: renamedLabel, description: 'Arts' }],
      },
    });

    const renamedTermId = (
      await caller.decision.getCategories({
        processInstanceId: instance.instance.id,
      })
    ).categories[0]!.id;

    // `proposalData` carries the labels that `setProposalCategories` resolves
    // against, so a stale copy would re-point the link back to the old term.
    expect(await storedCategoryLabels(proposal.id)).toEqual([renamedLabel]);

    // Prove it: an edit that touches only the title must leave the link alone.
    await caller.decision.updateProposal({
      proposalId: proposal.id,
      data: {
        proposalData: {
          title: `Mural program revised ${suffix}`,
          category: await storedCategoryLabels(proposal.id),
        },
      },
    });

    expect(await linkedTermIds(proposal.id)).toEqual([renamedTermId]);
  });

  it('does not cascade links through a chained rename applied in one save', async ({
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
    const labelA = `Alpha ${suffix}`;
    const labelB = `Bravo ${suffix}`;
    const labelC = `Charlie ${suffix}`;
    cleanupTermsByLabel([labelA, labelB, labelC], onTestFinished);
    await ensureProposalTaxonomy();

    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      config: {
        categories: [
          { id: 'cat-1', label: labelA, description: 'A' },
          { id: 'cat-2', label: labelB, description: 'B' },
        ],
      },
    });

    const proposalA = await caller.decision.createProposal({
      processInstanceId: instance.instance.id,
      proposalData: { title: `In A ${suffix}`, category: [labelA] },
    });
    testData.trackProfileForCleanup(proposalA.profileId);

    const proposalB = await caller.decision.createProposal({
      processInstanceId: instance.instance.id,
      proposalData: { title: `In B ${suffix}`, category: [labelB] },
    });
    testData.trackProfileForCleanup(proposalB.profileId);

    // One save renames A→B and B→C. Applied sequentially against live rows, the
    // first move would put A's proposal on term B and the second would then
    // sweep it onward to C. Reads are snapshotted, so each lands exactly once.
    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      config: {
        categories: [
          { id: 'cat-1', label: labelB, description: 'A' },
          { id: 'cat-2', label: labelC, description: 'B' },
        ],
      },
    });

    const categories = await caller.decision.getCategories({
      processInstanceId: instance.instance.id,
    });
    const termIdByName = new Map(
      categories.categories.map((category) => [category.name, category.id]),
    );

    expect(await linkedTermIds(proposalA.id)).toEqual([
      termIdByName.get(labelB),
    ]);
    expect(await linkedTermIds(proposalB.id)).toEqual([
      termIdByName.get(labelC),
    ]);
  });
});
