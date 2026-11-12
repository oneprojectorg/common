import {
  TestDecisionsDataManager,
  createCategoryReviewer,
  grantInstanceReviewerRole,
} from '@op/common/testing';
import { db, eq } from '@op/db/client';
import { categoryReviewers } from '@op/db/schema';
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

type OnTestFinished = (fn: () => void | Promise<void>) => void;

/** An instance in its first phase ("initial") with two configured categories. */
async function createStatusSetup({
  testData,
  onTestFinished,
}: {
  testData: TestDecisionsDataManager;
  onTestFinished: OnTestFinished;
}) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
  });
  const instanceId = setup.instance.instance.id;
  const { terms, configCategories } = await seedTwoCategories(onTestFinished);
  const [termA, termB] = terms;
  if (!termA || !termB) {
    throw new Error('Expected two category terms');
  }
  await injectInstanceCategories(instanceId, configCategories);

  return { setup, instanceId, termA, termB, configCategories };
}

async function stampRow({ id, at }: { id: string; at: string }) {
  await db
    .update(categoryReviewers)
    .set({ data: { developConfirmedAt: at } })
    .where(eq(categoryReviewers.id, id));
}

describe.concurrent('listCategoryDevelopmentStatus', () => {
  it('returns the stamps of the current phase rows only', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, termA } = await createStatusSetup({
      testData,
      onTestFinished,
    });
    const [confirmed, open, otherPhase, noPhase] = await Promise.all(
      [0, 1, 2, 3].map(() =>
        testData.createMemberUser({ organization: setup.organization }),
      ),
    );
    if (!confirmed || !open || !otherPhase || !noPhase) {
      throw new Error('Expected four members');
    }

    const at = new Date().toISOString();
    const [confirmedRow, , otherPhaseRow, noPhaseRow] = await Promise.all([
      createCategoryReviewer({
        processInstanceId: instanceId,
        taxonomyTermId: termA.id,
        reviewerProfileId: confirmed.profileId,
        phaseId: 'initial',
      }),
      createCategoryReviewer({
        processInstanceId: instanceId,
        taxonomyTermId: termA.id,
        reviewerProfileId: open.profileId,
        phaseId: 'initial',
      }),
      createCategoryReviewer({
        processInstanceId: instanceId,
        taxonomyTermId: termA.id,
        reviewerProfileId: otherPhase.profileId,
        phaseId: 'final',
      }),
      createCategoryReviewer({
        processInstanceId: instanceId,
        taxonomyTermId: termA.id,
        reviewerProfileId: noPhase.profileId,
        phaseId: null,
      }),
    ]);
    await Promise.all(
      [confirmedRow, otherPhaseRow, noPhaseRow].map((row) =>
        stampRow({ id: row.id, at }),
      ),
    );

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const result = await adminCaller.decision.listCategoryDevelopmentStatus({
      processInstanceId: instanceId,
    });

    const categoryA = result.items.find((c) => c.category.id === termA.id);
    expect(categoryA?.rows).toHaveLength(2);
    expect(categoryA?.rows).toEqual(
      expect.arrayContaining([
        { reviewerProfileId: confirmed.profileId, developConfirmedAt: at },
        { reviewerProfileId: open.profileId, developConfirmedAt: null },
      ]),
    );
  });

  it('returns a category with no row for the current phase with empty rows', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, termA, termB } = await createStatusSetup({
      testData,
      onTestFinished,
    });
    const reviewer = await testData.createMemberUser({
      organization: setup.organization,
    });
    await createCategoryReviewer({
      processInstanceId: instanceId,
      taxonomyTermId: termA.id,
      reviewerProfileId: reviewer.profileId,
      phaseId: 'initial',
    });

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const result = await adminCaller.decision.listCategoryDevelopmentStatus({
      processInstanceId: instanceId,
    });

    expect(result.items).toHaveLength(2);
    expect(result.items.find((c) => c.category.id === termB.id)?.rows).toEqual(
      [],
    );
  });

  it('keeps the stamp when the Process Builder saves the instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, termA, configCategories } =
      await createStatusSetup({ testData, onTestFinished });
    const reviewer = await testData.createMemberUser({
      organization: setup.organization,
    });
    const row = await createCategoryReviewer({
      processInstanceId: instanceId,
      taxonomyTermId: termA.id,
      reviewerProfileId: reviewer.profileId,
      phaseId: 'initial',
    });
    const at = new Date().toISOString();
    await stampRow({ id: row.id, at });

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    await adminCaller.decision.updateDecisionInstance({
      instanceId,
      name: 'Renamed',
      config: { categories: configCategories },
    });
    await adminCaller.decision.addCategoryReviewer({
      processInstanceId: instanceId,
      taxonomyTermId: termA.id,
      reviewerProfileId: reviewer.profileId,
      phaseId: 'initial',
    });

    const result = await adminCaller.decision.listCategoryDevelopmentStatus({
      processInstanceId: instanceId,
    });

    expect(result.items.find((c) => c.category.id === termA.id)?.rows).toEqual([
      { reviewerProfileId: reviewer.profileId, developConfirmedAt: at },
    ]);
  });

  it('lets a reviewer read and refuses a member without Review', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createStatusSetup({
      testData,
      onTestFinished,
    });
    const [reviewer, member] = await Promise.all([
      testData.createMemberUser({ organization: setup.organization }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [setup.instance.profileId],
      }),
    ]);
    await grantInstanceReviewerRole({
      instanceProfileId: setup.instance.profileId,
      authUserId: reviewer.authUserId,
      email: reviewer.email,
      roleName: `Reviewer ${reviewer.authUserId}`,
    });

    const [reviewerCaller, memberCaller] = await Promise.all([
      createAuthenticatedCaller(reviewer.email),
      createAuthenticatedCaller(member.email),
    ]);

    await expect(
      reviewerCaller.decision.listCategoryDevelopmentStatus({
        processInstanceId: instanceId,
      }),
    ).resolves.toMatchObject({ items: expect.any(Array) });

    await expect(
      memberCaller.decision.listCategoryDevelopmentStatus({
        processInstanceId: instanceId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});
