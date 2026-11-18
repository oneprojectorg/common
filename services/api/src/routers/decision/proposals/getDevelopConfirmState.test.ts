import {
  TEST_PERMISSION_BITS,
  TestDecisionsDataManager,
  createDevelopPhaseSetup,
} from '@op/common/testing';
import { describe, expect, it } from 'vitest';

import { createCategoryDevelopReviewer } from '../../../test/helpers/categoryDevelopTestUtils';
import { seedTwoCategories } from '../../../test/helpers/categoryTestUtils';
import { createAuthenticatedCaller } from '../../../test/supabase-utils';

type OnTestFinished = (fn: () => void | Promise<void>) => void;

describe.concurrent('getDevelopConfirmState', () => {
  it('lets a Develop Proposals holder with no row for the phase read it, without the confirm', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, termA } = await createStateSetup({
      testData,
      onTestFinished,
    });
    // A row of another phase does not count.
    const reviewer = await createCategoryDevelopReviewer({
      testData,
      setup,
      rows: [{ taxonomyTermId: termA.id, phaseId: 'initial' }],
    });
    const caller = await createAuthenticatedCaller(reviewer.email);

    const state = await caller.decision.getDevelopConfirmState({
      processInstanceId: instanceId,
    });

    expect(state).toEqual({ canConfirm: false, lock: null, categoryNames: [] });
  });

  it('returns the caller’s categories by label and no lock before a confirm', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, termA, termB, labels } = await createStateSetup({
      testData,
      onTestFinished,
    });
    const reviewer = await createCategoryDevelopReviewer({
      testData,
      setup,
      rows: [
        { taxonomyTermId: termB.id, phaseId: 'final' },
        { taxonomyTermId: termA.id, phaseId: 'final' },
      ],
    });
    const caller = await createAuthenticatedCaller(reviewer.email);

    const state = await caller.decision.getDevelopConfirmState({
      processInstanceId: instanceId,
    });

    expect(state).toEqual({
      canConfirm: true,
      lock: null,
      categoryNames: labels,
    });
  });

  it('reports the confirmed lock after a confirm, and none after an unconfirm', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, termA, labels } = await createStateSetup({
      testData,
      onTestFinished,
    });
    const reviewer = await createCategoryDevelopReviewer({
      testData,
      setup,
      rows: [{ taxonomyTermId: termA.id, phaseId: 'final' }],
    });
    const caller = await createAuthenticatedCaller(reviewer.email);

    await caller.decision.confirmCategoryDevelopment({
      processInstanceId: instanceId,
    });
    const confirmed = await caller.decision.getDevelopConfirmState({
      processInstanceId: instanceId,
    });

    await caller.decision.unconfirmCategoryDevelopment({
      processInstanceId: instanceId,
    });
    const unconfirmed = await caller.decision.getDevelopConfirmState({
      processInstanceId: instanceId,
    });

    expect(confirmed).toEqual({
      canConfirm: true,
      lock: 'confirmed',
      categoryNames: [labels[0]],
    });
    expect(unconfirmed.lock).toBeNull();
  });

  it('never offers the confirm to an admin, who is not locked', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createStateSetup({
      testData,
      onTestFinished,
    });
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    const state = await adminCaller.decision.getDevelopConfirmState({
      processInstanceId: instanceId,
    });

    expect(state.canConfirm).toBe(false);
    expect(state.lock).toBeNull();
  });

  it('refuses a member without Develop Proposals', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, termA } = await createStateSetup({
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
      caller.decision.getDevelopConfirmState({ processInstanceId: instanceId }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});

/** A develop phase ("final") with an open window and two category terms. */
async function createStateSetup({
  testData,
  onTestFinished,
}: {
  testData: TestDecisionsDataManager;
  onTestFinished: OnTestFinished;
}) {
  const [{ setup, instanceId }, { terms, labels }] = await Promise.all([
    createDevelopPhaseSetup({ testData }),
    seedTwoCategories(onTestFinished),
  ]);
  const [termA, termB] = terms;
  if (!termA || !termB) {
    throw new Error('Expected two category terms');
  }

  return { setup, instanceId, termA, termB, labels };
}
