import {
  TEST_PERMISSION_BITS,
  TestDecisionsDataManager,
} from '@op/common/testing';
import { db, eq, sql } from '@op/db/client';
import { categoryReviewers } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import {
  createCategoryDevelopReviewer,
  createCategoryDevelopSetup,
  getCategoryReviewerData,
} from '../../../test/helpers/categoryDevelopTestUtils';
import { createAuthenticatedCaller } from '../../../test/supabase-utils';

const stamped = { developConfirmedAt: expect.any(String) };

describe.concurrent('confirmCategoryDevelopment', () => {
  it('stamps the own row of a reviewer and no other row', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, termA } = await createCategoryDevelopSetup({
      testData,
      onTestFinished,
    });
    const [reviewer, other] = await Promise.all(
      [0, 1].map(() =>
        createCategoryDevelopReviewer({
          testData,
          setup,
          rows: [{ taxonomyTermId: termA.id, phaseId: 'final' }],
        }),
      ),
    );
    if (!reviewer || !other) {
      throw new Error('Expected two reviewers');
    }

    const caller = await createAuthenticatedCaller(reviewer.email);
    const result = await caller.decision.confirmCategoryDevelopment({
      processInstanceId: instanceId,
      taxonomyTermId: termA.id,
    });

    expect(result.rows).toEqual([
      {
        reviewerProfileId: reviewer.profileId,
        developConfirmedAt: expect.any(String),
      },
    ]);
    const data = await getCategoryReviewerData([
      ...reviewer.rowIds,
      ...other.rowIds,
    ]);
    expect(data.get(reviewer.rowIds[0] ?? '')).toEqual(stamped);
    expect(data.get(other.rowIds[0] ?? '')).toEqual({});
  });

  it('refuses a Develop Proposals holder with no row for the category', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, termA, termB } =
      await createCategoryDevelopSetup({ testData, onTestFinished });
    const reviewer = await createCategoryDevelopReviewer({
      testData,
      setup,
      rows: [{ taxonomyTermId: termB.id, phaseId: 'final' }],
    });

    const caller = await createAuthenticatedCaller(reviewer.email);
    await expect(
      caller.decision.confirmCategoryDevelopment({
        processInstanceId: instanceId,
        taxonomyTermId: termA.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('refuses Review and an own row without Develop Proposals', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, termA } = await createCategoryDevelopSetup({
      testData,
      onTestFinished,
    });
    const reviewer = await createCategoryDevelopReviewer({
      testData,
      setup,
      rows: [{ taxonomyTermId: termA.id, phaseId: 'final' }],
      decisionsPermission:
        TEST_PERMISSION_BITS.READ | TEST_PERMISSION_BITS.REVIEW,
    });

    const caller = await createAuthenticatedCaller(reviewer.email);
    await expect(
      caller.decision.confirmCategoryDevelopment({
        processInstanceId: instanceId,
        taxonomyTermId: termA.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    const data = await getCategoryReviewerData(reviewer.rowIds);
    expect(data.get(reviewer.rowIds[0] ?? '')).toEqual({});
  });

  it('lets a profile admin and a decisions admin without Develop Proposals stamp every row', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, termA, termB } =
      await createCategoryDevelopSetup({ testData, onTestFinished });
    const { ADMIN, READ } = TEST_PERMISSION_BITS;
    const [profileAdmin, decisionsAdmin, rowA, rowB] = await Promise.all([
      createCategoryDevelopReviewer({
        testData,
        setup,
        rows: [],
        decisionsPermission: READ,
        profilePermission: READ | ADMIN,
      }),
      createCategoryDevelopReviewer({
        testData,
        setup,
        rows: [],
        decisionsPermission: READ | ADMIN,
      }),
      createCategoryDevelopReviewer({
        testData,
        setup,
        rows: [{ taxonomyTermId: termA.id, phaseId: 'final' }],
      }),
      createCategoryDevelopReviewer({
        testData,
        setup,
        rows: [{ taxonomyTermId: termB.id, phaseId: 'final' }],
      }),
    ]);

    const [profileAdminCaller, decisionsAdminCaller] = await Promise.all([
      createAuthenticatedCaller(profileAdmin.email),
      createAuthenticatedCaller(decisionsAdmin.email),
    ]);
    await profileAdminCaller.decision.confirmCategoryDevelopment({
      processInstanceId: instanceId,
      taxonomyTermId: termA.id,
    });
    await decisionsAdminCaller.decision.confirmCategoryDevelopment({
      processInstanceId: instanceId,
      taxonomyTermId: termB.id,
    });

    const data = await getCategoryReviewerData([
      ...rowA.rowIds,
      ...rowB.rowIds,
    ]);
    expect(data.get(rowA.rowIds[0] ?? '')).toEqual(stamped);
    expect(data.get(rowB.rowIds[0] ?? '')).toEqual(stamped);
  });

  it('refuses a reviewer whose only row has no phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, termA } = await createCategoryDevelopSetup({
      testData,
      onTestFinished,
    });
    const reviewer = await createCategoryDevelopReviewer({
      testData,
      setup,
      rows: [{ taxonomyTermId: termA.id, phaseId: null }],
    });

    const caller = await createAuthenticatedCaller(reviewer.email);
    await expect(
      caller.decision.confirmCategoryDevelopment({
        processInstanceId: instanceId,
        taxonomyTermId: termA.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    const data = await getCategoryReviewerData(reviewer.rowIds);
    expect(data.get(reviewer.rowIds[0] ?? '')).toEqual({});
  });

  it('refuses a confirm outside a develop phase', async ({
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

    const [reviewerCaller, adminCaller] = await Promise.all([
      createAuthenticatedCaller(reviewer.email),
      createAuthenticatedCaller(setup.userEmail),
    ]);
    await expect(
      reviewerCaller.decision.confirmCategoryDevelopment({
        processInstanceId: instanceId,
        taxonomyTermId: termA.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
    await expect(
      adminCaller.decision.confirmCategoryDevelopment({
        processInstanceId: instanceId,
        taxonomyTermId: termA.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('lets an admin with no row stamp every row of the category for the phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, termA, termB } =
      await createCategoryDevelopSetup({ testData, onTestFinished });
    const [first, second] = await Promise.all([
      createCategoryDevelopReviewer({
        testData,
        setup,
        rows: [
          { taxonomyTermId: termA.id, phaseId: 'final' },
          { taxonomyTermId: termA.id, phaseId: 'initial' },
          { taxonomyTermId: termA.id, phaseId: null },
        ],
      }),
      createCategoryDevelopReviewer({
        testData,
        setup,
        rows: [
          { taxonomyTermId: termA.id, phaseId: 'final' },
          { taxonomyTermId: termB.id, phaseId: 'final' },
        ],
      }),
    ]);
    if (!first || !second) {
      throw new Error('Expected two reviewers');
    }
    const [firstFinal, firstInitial, firstNoPhase] = first.rowIds;
    const [secondFinalA, secondFinalB] = second.rowIds;

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const result = await adminCaller.decision.confirmCategoryDevelopment({
      processInstanceId: instanceId,
      taxonomyTermId: termA.id,
    });

    expect(result.rows).toHaveLength(2);
    const data = await getCategoryReviewerData([
      ...first.rowIds,
      ...second.rowIds,
    ]);
    expect(data.get(firstFinal ?? '')).toEqual(stamped);
    expect(data.get(secondFinalA ?? '')).toEqual(stamped);
    expect(data.get(firstInitial ?? '')).toEqual({});
    expect(data.get(firstNoPhase ?? '')).toEqual({});
    expect(data.get(secondFinalB ?? '')).toEqual({});
  });

  it('refuses an admin confirm when the category has no row for the phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, termA } = await createCategoryDevelopSetup({
      testData,
      onTestFinished,
    });

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    await expect(
      adminCaller.decision.confirmCategoryDevelopment({
        processInstanceId: instanceId,
        taxonomyTermId: termA.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('overwrites the time on a second confirm', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, termA } = await createCategoryDevelopSetup({
      testData,
      onTestFinished,
    });
    const reviewer = await createCategoryDevelopReviewer({
      testData,
      setup,
      rows: [{ taxonomyTermId: termA.id, phaseId: 'final' }],
    });
    const rowId = reviewer.rowIds[0] ?? '';
    const earlier = '2020-01-01T00:00:00.000Z';
    await db
      .update(categoryReviewers)
      .set({ data: { developConfirmedAt: earlier } })
      .where(eq(categoryReviewers.id, rowId));

    const caller = await createAuthenticatedCaller(reviewer.email);
    const result = await caller.decision.confirmCategoryDevelopment({
      processInstanceId: instanceId,
      taxonomyTermId: termA.id,
    });

    const confirmedAt = result.rows[0]?.developConfirmedAt;
    expect(confirmedAt).not.toBe(earlier);
    const data = await getCategoryReviewerData([rowId]);
    expect(data.get(rowId)).toEqual({ developConfirmedAt: confirmedAt });
  });
  it('stores the stamp as a JSON object with a string time', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, termA } = await createCategoryDevelopSetup({
      testData,
      onTestFinished,
    });
    const reviewer = await createCategoryDevelopReviewer({
      testData,
      setup,
      rows: [{ taxonomyTermId: termA.id, phaseId: 'final' }],
    });
    const rowId = reviewer.rowIds[0] ?? '';

    const caller = await createAuthenticatedCaller(reviewer.email);
    await caller.decision.confirmCategoryDevelopment({
      processInstanceId: instanceId,
      taxonomyTermId: termA.id,
    });

    const types = await db.execute(
      sql`select jsonb_typeof(data) as "dataType", jsonb_typeof(data->'developConfirmedAt') as "stampType" from decision_category_reviewers where id = ${rowId}`,
    );
    expect([...types]).toEqual([{ dataType: 'object', stampType: 'string' }]);
  });

  it('lets an admin who names a reviewer stamp that row only', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, termA } = await createCategoryDevelopSetup({
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
    const result = await adminCaller.decision.confirmCategoryDevelopment({
      processInstanceId: instanceId,
      taxonomyTermId: termA.id,
      reviewerProfileId: first.profileId,
    });

    expect(result.rows).toEqual([
      {
        reviewerProfileId: first.profileId,
        developConfirmedAt: expect.any(String),
      },
    ]);
    const data = await getCategoryReviewerData([
      ...first.rowIds,
      ...second.rowIds,
    ]);
    expect(data.get(first.rowIds[0] ?? '')).toEqual(stamped);
    expect(data.get(second.rowIds[0] ?? '')).toEqual({});
  });

  it('refuses an admin who names a reviewer with no row for the phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, termA, termB } =
      await createCategoryDevelopSetup({ testData, onTestFinished });
    const reviewer = await createCategoryDevelopReviewer({
      testData,
      setup,
      rows: [
        { taxonomyTermId: termB.id, phaseId: 'final' },
        { taxonomyTermId: termA.id, phaseId: 'initial' },
      ],
    });

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    await expect(
      adminCaller.decision.confirmCategoryDevelopment({
        processInstanceId: instanceId,
        taxonomyTermId: termA.id,
        reviewerProfileId: reviewer.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('lets a reviewer who names themself stamp their own row only', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, termA } = await createCategoryDevelopSetup({
      testData,
      onTestFinished,
    });
    const [reviewer, other] = await Promise.all(
      [0, 1].map(() =>
        createCategoryDevelopReviewer({
          testData,
          setup,
          rows: [{ taxonomyTermId: termA.id, phaseId: 'final' }],
        }),
      ),
    );
    if (!reviewer || !other) {
      throw new Error('Expected two reviewers');
    }

    const caller = await createAuthenticatedCaller(reviewer.email);
    await caller.decision.confirmCategoryDevelopment({
      processInstanceId: instanceId,
      taxonomyTermId: termA.id,
      reviewerProfileId: reviewer.profileId,
    });

    const data = await getCategoryReviewerData([
      ...reviewer.rowIds,
      ...other.rowIds,
    ]);
    expect(data.get(reviewer.rowIds[0] ?? '')).toEqual(stamped);
    expect(data.get(other.rowIds[0] ?? '')).toEqual({});
  });

  it('refuses a reviewer who names another reviewer', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, termA } = await createCategoryDevelopSetup({
      testData,
      onTestFinished,
    });
    const [reviewer, other] = await Promise.all(
      [0, 1].map(() =>
        createCategoryDevelopReviewer({
          testData,
          setup,
          rows: [{ taxonomyTermId: termA.id, phaseId: 'final' }],
        }),
      ),
    );
    if (!reviewer || !other) {
      throw new Error('Expected two reviewers');
    }

    const caller = await createAuthenticatedCaller(reviewer.email);
    await expect(
      caller.decision.confirmCategoryDevelopment({
        processInstanceId: instanceId,
        taxonomyTermId: termA.id,
        reviewerProfileId: other.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    const data = await getCategoryReviewerData([
      ...reviewer.rowIds,
      ...other.rowIds,
    ]);
    expect(data.get(reviewer.rowIds[0] ?? '')).toEqual({});
    expect(data.get(other.rowIds[0] ?? '')).toEqual({});
  });
});
