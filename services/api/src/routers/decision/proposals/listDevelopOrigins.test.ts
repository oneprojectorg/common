import {
  TEST_PERMISSION_BITS,
  TestDecisionsDataManager,
  addProposalToCategory,
  createCategoryReviewer,
  createDevelopProposalsMember,
  createReviewAssignment,
  ensureProposalCategoryTerms,
  grantInstanceRole,
  testDevelopSchema,
} from '@op/common/testing';
import { db, inArray } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  proposalCategories,
  taxonomyTerms,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
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

const ids = (list: { items: { id: string }[] }) =>
  list.items.map((item) => item.id).sort();

/**
 * A develop phase ("final") after "initial", which holds three origins: two in
 * a category shared by two develop holders, each assigned one of them, and one
 * in another category.
 */
async function createOriginsSetup({
  testData,
  taskId,
  onTestFinished,
}: {
  testData: TestDecisionsDataManager;
  taskId: string;
  onTestFinished: (fn: () => Promise<void>) => void;
}) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
    processSchema: testDevelopSchema,
    status: ProcessStatus.PUBLISHED,
  });
  const instanceId = setup.instance.instance.id;

  const createOrigin = (title: string) =>
    testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title },
      status: ProposalStatus.SUBMITTED,
    });

  const [sharedA, sharedB, other] = await Promise.all([
    createOrigin('Shared A'),
    createOrigin('Shared B'),
    createOrigin('Other'),
  ]);
  const [sharedCategory, otherCategory] = await ensureProposalCategoryTerms([
    `shared-${taskId}`,
    `other-${taskId}`,
  ]);
  if (!sharedCategory || !otherCategory) {
    throw new Error('Failed to create the categories');
  }

  // Teardown asserts `taxonomy_terms` is empty; drop the links first so the
  // term delete can't trip the FK. Category reviewer rows cascade.
  const termIds = [sharedCategory.taxonomyTermId, otherCategory.taxonomyTermId];
  onTestFinished(async () => {
    await db
      .delete(proposalCategories)
      .where(inArray(proposalCategories.taxonomyTermId, termIds));
    await db.delete(taxonomyTerms).where(inArray(taxonomyTerms.id, termIds));
  });

  await Promise.all([
    addProposalToCategory({
      proposalId: sharedA.id,
      taxonomyTermId: sharedCategory.taxonomyTermId,
    }),
    addProposalToCategory({
      proposalId: sharedB.id,
      taxonomyTermId: sharedCategory.taxonomyTermId,
    }),
    addProposalToCategory({
      proposalId: other.id,
      taxonomyTermId: otherCategory.taxonomyTermId,
    }),
  ]);
  await testData.advancePhase({
    instanceId,
    fromPhaseId: 'initial',
    toPhaseId: 'final',
  });

  const [first, second] = await Promise.all([
    createDevelopProposalsMember({ testData, setup }),
    createDevelopProposalsMember({ testData, setup }),
  ]);

  await Promise.all(
    [first, second].flatMap((member, index) => [
      createReviewAssignment({
        processInstanceId: instanceId,
        proposalId: index === 0 ? sharedA.id : sharedB.id,
        reviewerProfileId: member.profileId,
        phaseId: 'initial',
      }),
      createCategoryReviewer({
        processInstanceId: instanceId,
        taxonomyTermId: sharedCategory.taxonomyTermId,
        reviewerProfileId: member.profileId,
      }),
    ]),
  );

  return {
    setup,
    instanceId,
    origins: { sharedA, sharedB, other },
    categories: { shared: sharedCategory, other: otherCategory },
    members: { first, second },
  };
}

describe.concurrent('listDevelopOrigins', () => {
  it('lists a develop holder their assigned origins, and the whole category under `categories`', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, origins, members } = await createOriginsSetup({
      testData,
      taskId: task.id,
      onTestFinished,
    });
    const [firstCaller, secondCaller] = await Promise.all([
      createAuthenticatedCaller(members.first.email),
      createAuthenticatedCaller(members.second.email),
    ]);

    const [firstAssigned, secondAssigned, firstCategories, secondCategories] =
      await Promise.all([
        firstCaller.decision.listDevelopOrigins({
          processInstanceId: instanceId,
        }),
        secondCaller.decision.listDevelopOrigins({
          processInstanceId: instanceId,
          scope: 'assigned',
        }),
        firstCaller.decision.listDevelopOrigins({
          processInstanceId: instanceId,
          scope: 'categories',
        }),
        secondCaller.decision.listDevelopOrigins({
          processInstanceId: instanceId,
          scope: 'categories',
        }),
      ]);

    expect(ids(firstAssigned)).toEqual([origins.sharedA.id]);
    expect(firstAssigned.total).toBe(1);
    expect(ids(secondAssigned)).toEqual([origins.sharedB.id]);

    const sharedIds = [origins.sharedA.id, origins.sharedB.id].sort();
    expect(ids(firstCategories)).toEqual(sharedIds);
    expect(ids(secondCategories)).toEqual(sharedIds);
  });

  it('refuses `all` to a develop holder', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, members } = await createOriginsSetup({
      testData,
      taskId: task.id,
      onTestFinished,
    });
    const caller = await createAuthenticatedCaller(members.first.email);

    await expect(
      caller.decision.listDevelopOrigins({
        processInstanceId: instanceId,
        scope: 'all',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('lists an admin every origin under `all`, narrowed by `categoryId`', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, origins, categories } = await createOriginsSetup(
      {
        testData,
        taskId: task.id,
        onTestFinished,
      },
    );
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const [everything, other, assigned] = await Promise.all([
      caller.decision.listDevelopOrigins({
        processInstanceId: instanceId,
        scope: 'all',
      }),
      caller.decision.listDevelopOrigins({
        processInstanceId: instanceId,
        scope: 'all',
        categoryId: categories.other.taxonomyTermId,
      }),
      caller.decision.listDevelopOrigins({ processInstanceId: instanceId }),
    ]);

    expect(ids(everything)).toEqual(
      [origins.sharedA.id, origins.sharedB.id, origins.other.id].sort(),
    );
    expect(everything.total).toBe(3);
    expect(ids(other)).toEqual([origins.other.id]);
    expect(other.total).toBe(1);
    // Nothing is assigned to the admin.
    expect(assigned.items).toEqual([]);
  });

  it('pages, sorts and searches origins in the database', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, origins } = await createOriginsSetup({
      testData,
      taskId: task.id,
      onTestFinished,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);
    const byCreation = [origins.sharedA, origins.sharedB, origins.other]
      .sort(
        (a, b) =>
          (a.createdAt ?? '').localeCompare(b.createdAt ?? '') ||
          a.id.localeCompare(b.id),
      )
      .map((origin) => origin.id);

    const first = await caller.decision.listDevelopOrigins({
      processInstanceId: instanceId,
      scope: 'all',
      dir: 'asc',
      limit: 2,
    });
    expect(first.items.map((item) => item.id)).toEqual(byCreation.slice(0, 2));
    expect(first.total).toBe(3);
    expect(first.next).not.toBeNull();

    const second = await caller.decision.listDevelopOrigins({
      processInstanceId: instanceId,
      scope: 'all',
      dir: 'asc',
      limit: 2,
      cursor: first.next,
    });
    expect(second.items.map((item) => item.id)).toEqual(byCreation.slice(2));
    expect(second.next).toBeNull();

    const shared = await caller.decision.listDevelopOrigins({
      processInstanceId: instanceId,
      scope: 'all',
      search: 'shared',
    });
    expect(ids(shared)).toEqual(
      [origins.sharedA.id, origins.sharedB.id].sort(),
    );
    expect(shared.total).toBe(2);
  });

  it("carries the caller's own entry for each origin on the page", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, origins, members } = await createOriginsSetup({
      testData,
      taskId: task.id,
      onTestFinished,
    });
    const [firstCaller, secondCaller] = await Promise.all([
      createAuthenticatedCaller(members.first.email),
      createAuthenticatedCaller(members.second.email),
    ]);
    const entry = await firstCaller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [origins.sharedA.id],
      proposalData: { title: 'Entry' },
    });
    testData.trackProfileForCleanup(entry.profileId);

    const [own, others] = await Promise.all([
      firstCaller.decision.listDevelopOrigins({
        processInstanceId: instanceId,
        scope: 'categories',
      }),
      secondCaller.decision.listDevelopOrigins({
        processInstanceId: instanceId,
        scope: 'categories',
      }),
    ]);

    expect(own.ownEntries).toEqual([
      {
        originId: origins.sharedA.id,
        id: entry.id,
        profileId: entry.profileId,
        status: ProposalStatus.DRAFT,
      },
    ]);
    expect(others.ownEntries).toEqual([]);
  });

  it('refuses a caller without develop access', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createOriginsSetup({
      testData,
      taskId: task.id,
      onTestFinished,
    });
    const reader = await testData.createMemberUser({
      organization: setup.organization,
    });
    await grantInstanceRole({
      instanceProfileId: setup.instance.profileId,
      authUserId: reader.authUserId,
      email: reader.email,
      roleName: `Read ${reader.authUserId}`,
      decisionsPermission: TEST_PERMISSION_BITS.READ,
    });
    const caller = await createAuthenticatedCaller(reader.email);

    await expect(
      caller.decision.listDevelopOrigins({ processInstanceId: instanceId }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});
