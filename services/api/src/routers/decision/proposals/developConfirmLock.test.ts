import {
  TEST_PERMISSION_BITS,
  TestDecisionsDataManager,
  addResultsPhase,
  createDevelopPhaseSetup,
} from '@op/common/testing';
import { ProposalStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { createCategoryDevelopReviewer } from '../../../test/helpers/categoryDevelopTestUtils';
import { seedTwoCategories } from '../../../test/helpers/categoryTestUtils';
import { createAuthenticatedCaller } from '../../../test/supabase-utils';

type OnTestFinished = (fn: () => void | Promise<void>) => void;

const lockedByConfirm = { cause: { name: 'ConflictError' } };
const windowClosed = { cause: { name: 'ValidationError' } };

describe.concurrent('develop confirm lock', () => {
  it('refuses a confirmed reviewer on prepare, advance and un-advance, and allows them again after unconfirm', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source, termA } = await createLockSetup({
      testData,
      onTestFinished,
    });
    const { caller } = await createReviewer({
      testData,
      setup,
      rows: [{ taxonomyTermId: termA.id, phaseId: 'final' }],
    });
    const draft = await createEntry({ testData, caller, instanceId, source });
    const advanced = await createEntry({
      testData,
      caller,
      instanceId,
      source,
    });
    await caller.decision.submitDevelopedProposal({ proposalId: advanced.id });

    await caller.decision.confirmCategoryDevelopment({
      processInstanceId: instanceId,
    });

    await expect(
      caller.decision.createDevelopedProposal({
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: { title: 'Refused' },
      }),
    ).rejects.toMatchObject(lockedByConfirm);
    await expect(
      caller.decision.submitDevelopedProposal({ proposalId: draft.id }),
    ).rejects.toMatchObject(lockedByConfirm);
    await expect(
      caller.decision.unsubmitDevelopedProposal({ proposalId: advanced.id }),
    ).rejects.toMatchObject(lockedByConfirm);

    await caller.decision.unconfirmCategoryDevelopment({
      processInstanceId: instanceId,
    });

    await createEntry({ testData, caller, instanceId, source });
    const submitted = await caller.decision.submitDevelopedProposal({
      proposalId: draft.id,
    });
    const unsubmitted = await caller.decision.unsubmitDevelopedProposal({
      proposalId: advanced.id,
    });

    expect(submitted.status).toBe(ProposalStatus.SUBMITTED);
    expect(unsubmitted.status).toBe(ProposalStatus.DRAFT);
  });

  it('does not lock a reviewer who confirmed only one of two categories', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source, termA, termB } = await createLockSetup({
      testData,
      onTestFinished,
    });
    const { caller } = await createReviewer({
      testData,
      setup,
      rows: [
        { taxonomyTermId: termA.id, phaseId: 'final' },
        { taxonomyTermId: termB.id, phaseId: 'final' },
      ],
    });
    await caller.decision.confirmCategoryDevelopment({
      processInstanceId: instanceId,
      taxonomyTermId: termA.id,
    });

    const entry = await createEntry({ testData, caller, instanceId, source });
    const submitted = await caller.decision.submitDevelopedProposal({
      proposalId: entry.id,
    });

    expect(submitted.status).toBe(ProposalStatus.SUBMITTED);
  });

  it('does not lock a Develop Proposals holder with no category row', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source, termA } = await createLockSetup({
      testData,
      onTestFinished,
    });
    const [reviewer, holder] = await Promise.all([
      createReviewer({
        testData,
        setup,
        rows: [{ taxonomyTermId: termA.id, phaseId: 'final' }],
      }),
      createReviewer({ testData, setup, rows: [] }),
    ]);
    await reviewer.caller.decision.confirmCategoryDevelopment({
      processInstanceId: instanceId,
    });

    const entry = await createEntry({
      testData,
      caller: holder.caller,
      instanceId,
      source,
    });
    const submitted = await holder.caller.decision.submitDevelopedProposal({
      proposalId: entry.id,
    });

    expect(submitted.status).toBe(ProposalStatus.SUBMITTED);
  });

  it('does not lock an admin whose category row is confirmed', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source, termA } = await createLockSetup({
      testData,
      onTestFinished,
    });
    const { ADMIN, READ } = TEST_PERMISSION_BITS;
    const { caller } = await createReviewer({
      testData,
      setup,
      rows: [{ taxonomyTermId: termA.id, phaseId: 'final' }],
      decisionsPermission: READ | ADMIN,
    });
    await caller.decision.confirmCategoryDevelopment({
      processInstanceId: instanceId,
      taxonomyTermId: termA.id,
    });

    const entry = await createEntry({ testData, caller, instanceId, source });
    const submitted = await caller.decision.submitDevelopedProposal({
      proposalId: entry.id,
    });

    expect(submitted.status).toBe(ProposalStatus.SUBMITTED);
  });

  it('refuses everyone, admins included, once selections are confirmed', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createLockSetup({
      testData,
      onTestFinished,
    });
    const { caller } = await createReviewer({ testData, setup, rows: [] });
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const draft = await createEntry({ testData, caller, instanceId, source });
    const advanced = await createEntry({
      testData,
      caller,
      instanceId,
      source,
    });
    await caller.decision.submitDevelopedProposal({ proposalId: advanced.id });

    await adminCaller.decision.submitManualSelection({
      processInstanceId: instanceId,
      proposalIds: [source.id],
    });

    for (const refusingCaller of [caller, adminCaller]) {
      await expect(
        refusingCaller.decision.createDevelopedProposal({
          processInstanceId: instanceId,
          sourceProposalIds: [source.id],
          proposalData: { title: 'Refused' },
        }),
      ).rejects.toMatchObject(windowClosed);
    }
    await expect(
      caller.decision.submitDevelopedProposal({ proposalId: draft.id }),
    ).rejects.toMatchObject(windowClosed);
    await expect(
      caller.decision.unsubmitDevelopedProposal({ proposalId: advanced.id }),
    ).rejects.toMatchObject(windowClosed);
  });
});

/**
 * A develop phase with an open window, one source and two category terms. A
 * results phase follows, so the develop phase is not the last.
 */
async function createLockSetup({
  testData,
  onTestFinished,
}: {
  testData: TestDecisionsDataManager;
  onTestFinished: OnTestFinished;
}) {
  const [{ setup, instanceId, source }, { terms }] = await Promise.all([
    createDevelopPhaseSetup({ testData }),
    seedTwoCategories(onTestFinished),
  ]);
  const [termA, termB] = terms;
  if (!termA || !termB) {
    throw new Error('Expected two category terms');
  }
  await addResultsPhase({ instanceId });

  return { setup, instanceId, source, termA, termB };
}

/** A member with Develop Proposals (unless `decisionsPermission` says otherwise) and the given rows. */
async function createReviewer(
  params: Parameters<typeof createCategoryDevelopReviewer>[0],
) {
  const reviewer = await createCategoryDevelopReviewer(params);
  const caller = await createAuthenticatedCaller(reviewer.email);

  return { ...reviewer, caller };
}

async function createEntry({
  testData,
  caller,
  instanceId,
  source,
}: {
  testData: TestDecisionsDataManager;
  caller: Awaited<ReturnType<typeof createAuthenticatedCaller>>;
  instanceId: string;
  source: { id: string };
}) {
  const entry = await caller.decision.createDevelopedProposal({
    processInstanceId: instanceId,
    sourceProposalIds: [source.id],
    proposalData: { title: 'Developed' },
  });
  testData.trackProfileForCleanup(entry.profileId);

  return entry;
}
