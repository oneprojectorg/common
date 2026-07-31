import { db, eq, inArray } from '@op/db/client';
import { processInstances, taxonomies, taxonomyTerms } from '@op/db/schema';
import { randomUUID } from 'node:crypto';
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
 * Creates the shared "proposal" taxonomy (if absent) and appends the given
 * terms. Labels are made unique per call so concurrent tests don't collide on
 * the (taxonomyId, termUri) unique constraint.
 */
async function seedProposalTaxonomy(
  termLabels: string[],
  onTestFinished: (fn: () => void | Promise<void>) => void,
) {
  const taxonomyId = randomUUID();

  const [inserted] = await db
    .insert(taxonomies)
    .values({ id: taxonomyId, name: 'proposal' })
    .onConflictDoNothing({ target: taxonomies.name })
    .returning({ id: taxonomies.id });

  let resolvedTaxonomyId: string;

  if (inserted) {
    resolvedTaxonomyId = inserted.id;
  } else {
    const [existing] = await db
      .select({ id: taxonomies.id })
      .from(taxonomies)
      .where(eq(taxonomies.name, 'proposal'));
    if (!existing) {
      throw new Error('proposal taxonomy not found after conflict');
    }
    resolvedTaxonomyId = existing.id;
  }

  const termRecords = termLabels.map((label) => ({
    id: randomUUID(),
    taxonomyId: resolvedTaxonomyId,
    termUri: label
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, ''),
    label,
  }));

  if (termRecords.length > 0) {
    await db.insert(taxonomyTerms).values(termRecords);
  }

  onTestFinished(async () => {
    if (termRecords.length > 0) {
      await db.delete(taxonomyTerms).where(
        inArray(
          taxonomyTerms.id,
          termRecords.map((t) => t.id),
        ),
      );
    }
  });

  return termRecords;
}

/** Injects config.categories into an existing process instance's instanceData. */
async function injectInstanceCategories(
  instanceId: string,
  categories: Array<{ id: string; label: string; description: string }>,
) {
  const [instance] = await db
    .select({ instanceData: processInstances.instanceData })
    .from(processInstances)
    .where(eq(processInstances.id, instanceId));

  if (!instance) {
    throw new Error(`Instance ${instanceId} not found`);
  }

  const instanceData = instance.instanceData as Record<string, unknown>;
  await db
    .update(processInstances)
    .set({
      instanceData: {
        ...instanceData,
        config: {
          ...((instanceData.config as Record<string, unknown>) ?? {}),
          categories,
        },
      },
    })
    .where(eq(processInstances.id, instanceId));
}

/** Two uniquely-labeled category terms plus the config labels that match them. */
async function seedTwoCategories(
  onTestFinished: (fn: () => void | Promise<void>) => void,
) {
  const suffix = randomUUID().slice(0, 8);
  const labels = [`District ${suffix} A`, `District ${suffix} B`];
  const terms = await seedProposalTaxonomy(labels, onTestFinished);
  return {
    labels,
    terms,
    configCategories: labels.map((label, i) => ({
      id: `cat-${i}`,
      label,
      description: `${label} proposals`,
    })),
  };
}

describe.concurrent('categoryReviewers CRUD', () => {
  it('adds a reviewer, is idempotent, and lists 0-reviewer categories', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;

    const { terms, configCategories } = await seedTwoCategories(onTestFinished);
    await injectInstanceCategories(instanceId, configCategories);

    const reviewer = await testData.createMemberUser({
      organization: setup.organization,
    });

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    const first = await adminCaller.decision.addCategoryReviewer({
      processInstanceId: instanceId,
      taxonomyTermId: terms[0]!.id,
      reviewerProfileId: reviewer.profileId,
    });

    // Adding the same tuple again is a no-op that resolves to the same row.
    const second = await adminCaller.decision.addCategoryReviewer({
      processInstanceId: instanceId,
      taxonomyTermId: terms[0]!.id,
      reviewerProfileId: reviewer.profileId,
    });

    expect(second.id).toBe(first.id);

    const result = await adminCaller.decision.listCategoryReviewers({
      processInstanceId: instanceId,
    });

    expect(result.categories).toHaveLength(2);

    const categoryOne = result.categories.find(
      (c) => c.category.id === terms[0]!.id,
    );
    const categoryTwo = result.categories.find(
      (c) => c.category.id === terms[1]!.id,
    );

    expect(categoryOne?.reviewers).toHaveLength(1);
    expect(categoryOne?.reviewers[0]).toMatchObject({
      scopeId: first.id,
      reviewerProfileId: reviewer.profileId,
      phaseId: null,
      profile: { id: reviewer.profileId },
    });

    // The category with no scope rows must still appear (LEFT-JOIN semantics).
    expect(categoryTwo?.reviewers).toHaveLength(0);
  });

  it('removes a reviewer and reports idempotent no-op removals', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;

    const { terms, configCategories } = await seedTwoCategories(onTestFinished);
    await injectInstanceCategories(instanceId, configCategories);

    const reviewer = await testData.createMemberUser({
      organization: setup.organization,
    });

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    await adminCaller.decision.addCategoryReviewer({
      processInstanceId: instanceId,
      taxonomyTermId: terms[0]!.id,
      reviewerProfileId: reviewer.profileId,
    });

    const removed = await adminCaller.decision.removeCategoryReviewer({
      processInstanceId: instanceId,
      taxonomyTermId: terms[0]!.id,
      reviewerProfileId: reviewer.profileId,
    });
    expect(removed.removed).toBe(true);

    const removedAgain = await adminCaller.decision.removeCategoryReviewer({
      processInstanceId: instanceId,
      taxonomyTermId: terms[0]!.id,
      reviewerProfileId: reviewer.profileId,
    });
    expect(removedAgain.removed).toBe(false);

    const result = await adminCaller.decision.listCategoryReviewers({
      processInstanceId: instanceId,
    });
    const categoryOne = result.categories.find(
      (c) => c.category.id === terms[0]!.id,
    );
    expect(categoryOne?.reviewers).toHaveLength(0);
  });

  it('treats instance-wide (phaseId NULL) and phase-scoped rows as distinct', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;

    const { terms, configCategories } = await seedTwoCategories(onTestFinished);
    await injectInstanceCategories(instanceId, configCategories);

    const reviewer = await testData.createMemberUser({
      organization: setup.organization,
    });

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    const instanceWide = await adminCaller.decision.addCategoryReviewer({
      processInstanceId: instanceId,
      taxonomyTermId: terms[0]!.id,
      reviewerProfileId: reviewer.profileId,
    });

    const phaseScoped = await adminCaller.decision.addCategoryReviewer({
      processInstanceId: instanceId,
      taxonomyTermId: terms[0]!.id,
      reviewerProfileId: reviewer.profileId,
      phaseId: 'review',
    });

    // Same tuple, different phase key → two separate rows.
    expect(phaseScoped.id).not.toBe(instanceWide.id);

    const instanceWideList = await adminCaller.decision.listCategoryReviewers({
      processInstanceId: instanceId,
    });
    expect(
      instanceWideList.categories.find((c) => c.category.id === terms[0]!.id)
        ?.reviewers,
    ).toHaveLength(1);
    expect(
      instanceWideList.categories.find((c) => c.category.id === terms[0]!.id)
        ?.reviewers[0]?.scopeId,
    ).toBe(instanceWide.id);

    const phaseList = await adminCaller.decision.listCategoryReviewers({
      processInstanceId: instanceId,
      phaseId: 'review',
    });
    expect(
      phaseList.categories.find((c) => c.category.id === terms[0]!.id)
        ?.reviewers,
    ).toHaveLength(1);
    expect(
      phaseList.categories.find((c) => c.category.id === terms[0]!.id)
        ?.reviewers[0]?.scopeId,
    ).toBe(phaseScoped.id);
  });

  it('isolates scope rows per instance even when the term is shared', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 2,
      grantAccess: true,
    });
    const instanceOneId = setup.instances[0]!.instance.id;
    const instanceTwoId = setup.instances[1]!.instance.id;

    // One shared taxonomy term configured as a category on BOTH instances.
    const { terms, configCategories } = await seedTwoCategories(onTestFinished);
    await injectInstanceCategories(instanceOneId, configCategories);
    await injectInstanceCategories(instanceTwoId, configCategories);

    const reviewer = await testData.createMemberUser({
      organization: setup.organization,
    });

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    await adminCaller.decision.addCategoryReviewer({
      processInstanceId: instanceOneId,
      taxonomyTermId: terms[0]!.id,
      reviewerProfileId: reviewer.profileId,
    });

    const listOne = await adminCaller.decision.listCategoryReviewers({
      processInstanceId: instanceOneId,
    });
    expect(
      listOne.categories.find((c) => c.category.id === terms[0]!.id)?.reviewers,
    ).toHaveLength(1);

    // Same shared term, different instance → no scope row leaks across.
    const listTwo = await adminCaller.decision.listCategoryReviewers({
      processInstanceId: instanceTwoId,
    });
    expect(
      listTwo.categories.find((c) => c.category.id === terms[0]!.id)?.reviewers,
    ).toHaveLength(0);
  });

  it('rejects non-admin callers on mutations', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;

    const { terms, configCategories } = await seedTwoCategories(onTestFinished);
    await injectInstanceCategories(instanceId, configCategories);

    // Member has READ but no ADMIN on the instance profile.
    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });

    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.decision.addCategoryReviewer({
        processInstanceId: instanceId,
        taxonomyTermId: terms[0]!.id,
        reviewerProfileId: member.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    await expect(
      memberCaller.decision.removeCategoryReviewer({
        processInstanceId: instanceId,
        taxonomyTermId: terms[0]!.id,
        reviewerProfileId: member.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('rejects an empty phaseId, which the COALESCE index would fold into instance-wide', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;

    const { terms, configCategories } = await seedTwoCategories(onTestFinished);
    await injectInstanceCategories(instanceId, configCategories);

    const reviewer = await testData.createMemberUser({
      organization: setup.organization,
    });

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    // '' is not a valid phase id; it must be rejected at the input boundary so
    // it can never collide with the NULL (instance-wide) key.
    await expect(
      adminCaller.decision.addCategoryReviewer({
        processInstanceId: instanceId,
        taxonomyTermId: terms[0]!.id,
        reviewerProfileId: reviewer.profileId,
        phaseId: '',
      }),
    ).rejects.toThrow();

    await expect(
      adminCaller.decision.listCategoryReviewers({
        processInstanceId: instanceId,
        phaseId: '',
      }),
    ).rejects.toThrow();
  });
});
