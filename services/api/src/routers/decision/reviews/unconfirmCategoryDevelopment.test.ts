import { TestDecisionsDataManager } from '@op/common/testing';
import { describe, expect, it } from 'vitest';

import {
  createCategoryDevelopReviewer,
  createCategoryDevelopSetup,
  getCategoryReviewerData,
} from '../../../test/helpers/categoryDevelopTestUtils';
import { createAuthenticatedCaller } from '../../../test/supabase-utils';

const stamped = { developConfirmedAt: expect.any(String) };

/** A develop phase with two reviewers on category A, both confirmed by the admin. */
async function createConfirmedCategory({
  testData,
  onTestFinished,
}: {
  testData: TestDecisionsDataManager;
  onTestFinished: (fn: () => void | Promise<void>) => void;
}) {
  const { setup, instanceId, termA, termB } = await createCategoryDevelopSetup({
    testData,
    onTestFinished,
  });
  const [first, second] = await Promise.all(
    [0, 1].map(() =>
      createCategoryDevelopReviewer({
        testData,
        setup,
        rows: [{ taxonomyTermId: termA.id, phaseId: 'final' }],
      }),
    ),
  );
  if (!first || !second) {
    throw new Error('Expected two reviewers');
  }

  const adminCaller = await createAuthenticatedCaller(setup.userEmail);
  await adminCaller.decision.confirmCategoryDevelopment({
    processInstanceId: instanceId,
    taxonomyTermId: termA.id,
  });

  return { setup, instanceId, termA, termB, first, second, adminCaller };
}

describe.concurrent('unconfirmCategoryDevelopment', () => {
  it('removes the stamp from the own row and leaves the other rows stamped', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, termA, first, second } = await createConfirmedCategory({
      testData,
      onTestFinished,
    });

    const caller = await createAuthenticatedCaller(first.email);
    const result = await caller.decision.unconfirmCategoryDevelopment({
      processInstanceId: instanceId,
      taxonomyTermId: termA.id,
    });

    expect(result.rows).toEqual([
      { reviewerProfileId: first.profileId, developConfirmedAt: null },
    ]);
    const data = await getCategoryReviewerData([
      ...first.rowIds,
      ...second.rowIds,
    ]);
    expect(data.get(first.rowIds[0] ?? '')).toEqual({});
    expect(data.get(second.rowIds[0] ?? '')).toEqual(stamped);
  });

  it('refuses a reviewer who unconfirms a category where another person has the row', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, termA, first, second } =
      await createConfirmedCategory({ testData, onTestFinished });
    const outsider = await createCategoryDevelopReviewer({
      testData,
      setup,
      rows: [],
    });

    const caller = await createAuthenticatedCaller(outsider.email);
    await expect(
      caller.decision.unconfirmCategoryDevelopment({
        processInstanceId: instanceId,
        taxonomyTermId: termA.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    const data = await getCategoryReviewerData([
      ...first.rowIds,
      ...second.rowIds,
    ]);
    expect(data.get(first.rowIds[0] ?? '')).toEqual(stamped);
    expect(data.get(second.rowIds[0] ?? '')).toEqual(stamped);
  });

  it('lets an admin clear the stamp of every row of the category', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, termA, first, second, adminCaller } =
      await createConfirmedCategory({ testData, onTestFinished });

    const result = await adminCaller.decision.unconfirmCategoryDevelopment({
      processInstanceId: instanceId,
      taxonomyTermId: termA.id,
    });

    expect(result.rows).toHaveLength(2);
    const data = await getCategoryReviewerData([
      ...first.rowIds,
      ...second.rowIds,
    ]);
    expect(data.get(first.rowIds[0] ?? '')).toEqual({});
    expect(data.get(second.rowIds[0] ?? '')).toEqual({});
  });

  it('refuses an unconfirm outside a develop phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, termA } = await createCategoryDevelopSetup({
      testData,
      onTestFinished,
      advance: false,
    });
    const reviewer = await createCategoryDevelopReviewer({
      testData,
      setup,
      rows: [{ taxonomyTermId: termA.id, phaseId: 'initial' }],
    });

    const caller = await createAuthenticatedCaller(reviewer.email);
    await expect(
      caller.decision.unconfirmCategoryDevelopment({
        processInstanceId: instanceId,
        taxonomyTermId: termA.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });
});
