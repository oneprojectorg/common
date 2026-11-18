import { TestDecisionsDataManager } from '@op/common/testing';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import {
  injectInstanceCategories,
  seedTwoCategories,
} from '../../../test/helpers/categoryTestUtils';
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

    expect(result.items).toHaveLength(2);

    const categoryOne = result.items.find(
      (c) => c.category.id === terms[0]!.id,
    );
    const categoryTwo = result.items.find(
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
    const categoryOne = result.items.find(
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
      instanceWideList.items.find((c) => c.category.id === terms[0]!.id)
        ?.reviewers,
    ).toHaveLength(1);
    expect(
      instanceWideList.items.find((c) => c.category.id === terms[0]!.id)
        ?.reviewers[0]?.scopeId,
    ).toBe(instanceWide.id);

    const phaseList = await adminCaller.decision.listCategoryReviewers({
      processInstanceId: instanceId,
      phaseId: 'review',
    });
    expect(
      phaseList.items.find((c) => c.category.id === terms[0]!.id)?.reviewers,
    ).toHaveLength(1);
    expect(
      phaseList.items.find((c) => c.category.id === terms[0]!.id)?.reviewers[0]
        ?.scopeId,
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
      listOne.items.find((c) => c.category.id === terms[0]!.id)?.reviewers,
    ).toHaveLength(1);

    // Same shared term, different instance → no scope row leaks across.
    const listTwo = await adminCaller.decision.listCategoryReviewers({
      processInstanceId: instanceTwoId,
    });
    expect(
      listTwo.items.find((c) => c.category.id === terms[0]!.id)?.reviewers,
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
