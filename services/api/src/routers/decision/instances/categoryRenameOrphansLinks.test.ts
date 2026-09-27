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
    expect(before.items).toHaveLength(1);
    const originalTermId = before.items[0]!.id;

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
    expect(before.items.map((c) => c.id)).toContain(originalTermId);

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
    expect(after.items).toHaveLength(1);
    const renamedTermId = after.items[0]!.id;

    // The rename minted a brand-new term (the root cause of the orphaning).
    expect(renamedTermId).not.toBe(originalTermId);

    // The proposal's link is re-pointed to the renamed term, so it stays
    // discoverable under a category `getCategories` actually returns.
    const links = await linkedTermIds(proposal.id);
    expect(links).toEqual([renamedTermId]);
    expect(after.items.map((c) => c.id)).toContain(links[0]);
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
    const sharedTermId = sharedCategories.items[0]!.id;

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
    const originalTermId = before.items[0]!.id;

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
    const renamedTermId = after.items[0]!.id;
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
    ).items[0]!.id;

    // `proposalData` carries the labels that `setProposalCategories` resolves
    // against, so a stale copy would re-point the link back to the old term.
    expect(await storedCategoryLabels(proposal.id)).toEqual([renamedLabel]);

    // Prove it: an edit that touches only the title must leave the link alone.
    await caller.decision.updateProposal({
      proposalId: proposal.id,
      data: {
        proposalData: {
          // An update that carries `proposalData` must resend the proposal's
          // own `collaborationDocId`, so start from the stored data.
          ...proposal.proposalData,
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
      categories.items.map((category) => [category.name, category.id]),
    );

    expect(await linkedTermIds(proposalA.id)).toEqual([
      termIdByName.get(labelB),
    ]);
    expect(await linkedTermIds(proposalB.id)).toEqual([
      termIdByName.get(labelC),
    ]);
  });

  it('swaps two categories in one save without collapsing both onto one term', async ({
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
    const labelA = `Swap Alpha ${suffix}`;
    const labelB = `Swap Bravo ${suffix}`;
    cleanupTermsByLabel([labelA, labelB], onTestFinished);
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

    const before = await caller.decision.getCategories({
      processInstanceId: instance.instance.id,
    });
    const termIdByNameBefore = new Map(
      before.items.map((category) => [category.name, category.id]),
    );

    const proposalA = await caller.decision.createProposal({
      processInstanceId: instance.instance.id,
      proposalData: { title: `Swap in A ${suffix}`, category: [labelA] },
    });
    testData.trackProfileForCleanup(proposalA.profileId);

    const proposalB = await caller.decision.createProposal({
      processInstanceId: instance.instance.id,
      proposalData: { title: `Swap in B ${suffix}`, category: [labelB] },
    });
    testData.trackProfileForCleanup(proposalB.profileId);

    // One save swaps the two labels. Applied against live rows, the first move
    // would put A's proposal on term B and the second would sweep both back
    // onto term A; the snapshot makes each land exactly once.
    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      config: {
        categories: [
          { id: 'cat-1', label: labelB, description: 'A' },
          { id: 'cat-2', label: labelA, description: 'B' },
        ],
      },
    });

    // The terms themselves are unchanged — only which proposal points at which.
    expect(await linkedTermIds(proposalA.id)).toEqual([
      termIdByNameBefore.get(labelB),
    ]);
    expect(await linkedTermIds(proposalB.id)).toEqual([
      termIdByNameBefore.get(labelA),
    ]);
  });

  it("stores the pre-existing term's own label when a rename slugs onto it", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 2,
      grantAccess: true,
    });
    const [instanceA, instanceB] = setup.instances;
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const suffix = labelSuffix(task.id);
    const existingLabel = `Affordable Housing ${suffix}`;
    const originalLabel = `Housing ${suffix}`;
    // Same slug as `existingLabel`, so no new term is minted for it.
    const renamedLabel = `affordable housing ${suffix}`;
    cleanupTermsByLabel(
      [existingLabel, originalLabel, renamedLabel],
      onTestFinished,
    );
    await ensureProposalTaxonomy();

    // Instance A mints the shared term with its own capitalisation.
    await caller.decision.updateDecisionInstance({
      instanceId: instanceA!.instance.id,
      config: {
        categories: [
          { id: 'cat-1', label: existingLabel, description: 'Housing' },
        ],
      },
    });
    const existingTermId = (
      await caller.decision.getCategories({
        processInstanceId: instanceA!.instance.id,
      })
    ).items[0]!.id;

    await caller.decision.updateDecisionInstance({
      instanceId: instanceB!.instance.id,
      config: {
        categories: [
          { id: 'cat-1', label: originalLabel, description: 'Housing' },
        ],
      },
    });

    const proposal = await caller.decision.createProposal({
      processInstanceId: instanceB!.instance.id,
      proposalData: {
        title: `Housing units ${suffix}`,
        category: [originalLabel],
      },
    });
    testData.trackProfileForCleanup(proposal.profileId);

    // Instance B's admin types the label in a different case. It slugs onto the
    // term instance A already minted, so no term is created for the new text.
    await caller.decision.updateDecisionInstance({
      instanceId: instanceB!.instance.id,
      config: {
        categories: [
          { id: 'cat-1', label: renamedLabel, description: 'Housing' },
        ],
      },
    });

    expect(await linkedTermIds(proposal.id)).toEqual([existingTermId]);

    // `setProposalCategories` resolves by exact `taxonomyTerms.label`, so the
    // stored copy has to be the term's text, not the config's lower-case label.
    expect(await storedCategoryLabels(proposal.id)).toEqual([existingLabel]);

    // A title-only edit re-resolves the stored labels; they must still match.
    await caller.decision.updateProposal({
      proposalId: proposal.id,
      data: {
        proposalData: {
          ...proposal.proposalData,
          title: `Housing units revised ${suffix}`,
          category: await storedCategoryLabels(proposal.id),
        },
      },
    });

    expect(await linkedTermIds(proposal.id)).toEqual([existingTermId]);
  });

  it('collapses the duplicate when a proposal already holds both the old and the new label', async ({
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
    const labelA = `Merge Source ${suffix}`;
    const labelB = `Merge Target ${suffix}`;
    cleanupTermsByLabel([labelA, labelB], onTestFinished);
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

    const before = await caller.decision.getCategories({
      processInstanceId: instance.instance.id,
    });
    const termIdB = before.items.find((c) => c.name === labelB)!.id;

    // Tagged with both categories, so the rename's destination is already held.
    const proposal = await caller.decision.createProposal({
      processInstanceId: instance.instance.id,
      proposalData: {
        title: `In both ${suffix}`,
        category: [labelA, labelB],
      },
    });
    testData.trackProfileForCleanup(proposal.profileId);
    expect(await linkedTermIds(proposal.id)).toHaveLength(2);

    // The admin merges A into B: one category, renamed onto B's label.
    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      config: {
        categories: [{ id: 'cat-1', label: labelB, description: 'A' }],
      },
    });

    expect(await linkedTermIds(proposal.id)).toEqual([termIdB]);
    expect(await storedCategoryLabels(proposal.id)).toEqual([labelB]);
  });

  it('re-points a second rename whose stored label is another instance’s term text', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 2,
      grantAccess: true,
    });
    const [instanceA, instanceB] = setup.instances;
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const suffix = labelSuffix(task.id);
    const existingLabel = `Affordable Housing ${suffix}`;
    const originalLabel = `Housing ${suffix}`;
    // Same slug as `existingLabel`, so the first rename lands on A's term and
    // the stored copy becomes A's capitalisation rather than this label.
    const renamedLabel = `affordable housing ${suffix}`;
    const finalLabel = `Transport ${suffix}`;
    cleanupTermsByLabel(
      [existingLabel, originalLabel, renamedLabel, finalLabel],
      onTestFinished,
    );
    await ensureProposalTaxonomy();

    await caller.decision.updateDecisionInstance({
      instanceId: instanceA!.instance.id,
      config: {
        categories: [
          { id: 'cat-1', label: existingLabel, description: 'Housing' },
        ],
      },
    });

    await caller.decision.updateDecisionInstance({
      instanceId: instanceB!.instance.id,
      config: {
        categories: [
          { id: 'cat-1', label: originalLabel, description: 'Housing' },
        ],
      },
    });

    const proposal = await caller.decision.createProposal({
      processInstanceId: instanceB!.instance.id,
      proposalData: {
        title: `Housing units ${suffix}`,
        category: [originalLabel],
      },
    });
    testData.trackProfileForCleanup(proposal.profileId);

    // First rename: `Housing` → `affordable housing`, which slugs onto A's term.
    await caller.decision.updateDecisionInstance({
      instanceId: instanceB!.instance.id,
      config: {
        categories: [
          { id: 'cat-1', label: renamedLabel, description: 'Housing' },
        ],
      },
    });
    expect(await storedCategoryLabels(proposal.id)).toEqual([existingLabel]);

    // Second rename of the same category. The config's old label is
    // `affordable housing`, but the stored copy says `Affordable Housing`, so a
    // map keyed only on the config label would leave the copy stale.
    await caller.decision.updateDecisionInstance({
      instanceId: instanceB!.instance.id,
      config: {
        categories: [
          { id: 'cat-1', label: finalLabel, description: 'Housing' },
        ],
      },
    });

    const finalTermId = (
      await caller.decision.getCategories({
        processInstanceId: instanceB!.instance.id,
      })
    ).items[0]!.id;

    expect(await linkedTermIds(proposal.id)).toEqual([finalTermId]);
    expect(await storedCategoryLabels(proposal.id)).toEqual([finalLabel]);

    // A title-only edit re-resolves the stored labels; a stale copy would drag
    // the link back to the previous term.
    await caller.decision.updateProposal({
      proposalId: proposal.id,
      data: {
        proposalData: {
          ...proposal.proposalData,
          title: `Housing units revised ${suffix}`,
          category: await storedCategoryLabels(proposal.id),
        },
      },
    });

    expect(await linkedTermIds(proposal.id)).toEqual([finalTermId]);
  });

  it('does not add the new link when the proposal no longer holds the old one', async ({
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
    const labelA = `Retag Alpha ${suffix}`;
    const labelB = `Retag Bravo ${suffix}`;
    const labelD = `Retag Delta ${suffix}`;
    cleanupTermsByLabel([labelA, labelB, labelD], onTestFinished);
    await ensureProposalTaxonomy();

    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      config: {
        categories: [
          { id: 'cat-1', label: labelA, description: 'A' },
          { id: 'cat-2', label: labelD, description: 'D' },
        ],
      },
    });

    const before = await caller.decision.getCategories({
      processInstanceId: instance.instance.id,
    });
    const termIdD = before.items.find((c) => c.name === labelD)!.id;

    const proposal = await caller.decision.createProposal({
      processInstanceId: instance.instance.id,
      proposalData: { title: `Retagged ${suffix}`, category: [labelA] },
    });
    testData.trackProfileForCleanup(proposal.profileId);

    // The author moves the proposal off A before the admin renames A.
    await caller.decision.updateProposal({
      proposalId: proposal.id,
      data: {
        proposalData: {
          ...proposal.proposalData,
          title: `Retagged ${suffix}`,
          category: [labelD],
        },
      },
    });
    expect(await linkedTermIds(proposal.id)).toEqual([termIdD]);

    // A→B. The proposal holds no A link any more, so the rename must add
    // nothing: an insert derived from the pre-delete snapshot would give it B.
    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      config: {
        categories: [
          { id: 'cat-1', label: labelB, description: 'A' },
          { id: 'cat-2', label: labelD, description: 'D' },
        ],
      },
    });

    expect(await linkedTermIds(proposal.id)).toEqual([termIdD]);
    expect(await storedCategoryLabels(proposal.id)).toEqual([labelD]);
  });

  it('skips a rename whose old label is shared by two config categories', async ({
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
    const labelA = `Ambiguous Alpha ${suffix}`;
    const labelB = `Ambiguous Bravo ${suffix}`;
    cleanupTermsByLabel([labelA, labelB], onTestFinished);
    await ensureProposalTaxonomy();

    // The API accepts two categories with distinct ids and the same label, so
    // both config rows resolve to the one taxonomy term.
    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      config: {
        categories: [
          { id: 'cat-1', label: labelA, description: 'first' },
          { id: 'cat-2', label: labelA, description: 'second' },
        ],
      },
    });

    const before = await caller.decision.getCategories({
      processInstanceId: instance.instance.id,
    });
    const termIdA = before.items.find((c) => c.name === labelA)!.id;

    const proposal = await caller.decision.createProposal({
      processInstanceId: instance.instance.id,
      proposalData: { title: `Ambiguous ${suffix}`, category: [labelA] },
    });
    testData.trackProfileForCleanup(proposal.profileId);
    expect(await linkedTermIds(proposal.id)).toEqual([termIdA]);

    // Renaming ONE of them leaves the other still labelled A, so the term's
    // rows can't be attributed to either category. The rename is skipped.
    await caller.decision.updateDecisionInstance({
      instanceId: instance.instance.id,
      config: {
        categories: [
          { id: 'cat-1', label: labelB, description: 'first' },
          { id: 'cat-2', label: labelA, description: 'second' },
        ],
      },
    });

    expect(await linkedTermIds(proposal.id)).toEqual([termIdA]);
    expect(await storedCategoryLabels(proposal.id)).toEqual([labelA]);
  });
});
