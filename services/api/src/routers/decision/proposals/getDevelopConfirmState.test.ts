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

    expect(state).toEqual({
      canConfirm: false,
      lock: null,
      categoryNames: [],
      canPublish: false,
    });
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
      canPublish: false,
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
      // Every row is confirmed, but only an admin publishes.
      canPublish: false,
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

  it('lets an admin publish only once every category reviewer row of the phase is confirmed', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, termA, termB } = await createStateSetup({
      testData,
      onTestFinished,
    });
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const readCanPublish = async () =>
      (
        await adminCaller.decision.getDevelopConfirmState({
          processInstanceId: instanceId,
        })
      ).canPublish;

    const withNoRow = await readCanPublish();

    const [first] = await Promise.all([
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
    const firstCaller = await createAuthenticatedCaller(first.email);
    await firstCaller.decision.confirmCategoryDevelopment({
      processInstanceId: instanceId,
    });
    const withOneUnconfirmed = await readCanPublish();

    await adminCaller.decision.confirmCategoryDevelopment({
      processInstanceId: instanceId,
      taxonomyTermId: termB.id,
    });
    const withAllConfirmed = await readCanPublish();

    expect(withNoRow).toBe(false);
    expect(withOneUnconfirmed).toBe(false);
    expect(withAllConfirmed).toBe(true);
  });

  it('stops offering the publish once the phase is published', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, termA } = await createStateSetup({
      testData,
      onTestFinished,
    });
    await createCategoryDevelopReviewer({
      testData,
      setup,
      rows: [{ taxonomyTermId: termA.id, phaseId: 'final' }],
    });
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    await adminCaller.decision.confirmCategoryDevelopment({
      processInstanceId: instanceId,
      taxonomyTermId: termA.id,
    });

    await adminCaller.decision.publishDevelopedProposals({
      processInstanceId: instanceId,
    });
    const state = await adminCaller.decision.getDevelopConfirmState({
      processInstanceId: instanceId,
    });

    expect(state.lock).toBe('windowClosed');
    expect(state.canPublish).toBe(false);
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
