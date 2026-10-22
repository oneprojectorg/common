import {
  TestDecisionsDataManager,
  schemaWithoutPipeline,
} from '@op/common/testing';
import { ProcessStatus, ProposalStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { createGatingCallers } from '../../../test/helpers/gating/callers';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
} from '../../../test/helpers/gating/decision';
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

// Submission passes all proposals to review; review's zero-limit pipeline
// strands them, leaving 'final' awaiting manual selection (which mints the
// decision_process_results row that getInstanceResults reads).
const schemaWithZeroSelectingReview = {
  ...schemaWithoutPipeline,
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      rules: {},
      selectionPipeline: { version: '1.0.0', blocks: [] },
    },
    {
      id: 'review',
      name: 'Review',
      rules: {},
      selectionPipeline: {
        version: '1.0.0',
        blocks: [{ id: 'zero', type: 'limit', count: 0 }],
      },
    },
    { id: 'final', name: 'Final', rules: {} },
  ],
};

async function createInstanceWithSelectedProposal(
  testData: TestDecisionsDataManager,
  taskId: string,
) {
  const setup = await testData.createDecisionSetup({
    processSchema: schemaWithZeroSelectingReview,
    instanceCount: 1,
    status: ProcessStatus.PUBLISHED,
  });
  const instanceId = setup.instance.instance.id;
  const caller = await createAuthenticatedCaller(setup.userEmail);

  const proposal = await testData.createProposal({
    userEmail: setup.userEmail,
    processInstanceId: instanceId,
    proposalData: {
      title: `Selected Proposal ${taskId}`,
      description: '<p>This is <strong>rich</strong> content</p>',
    },
    status: ProposalStatus.APPROVED,
  });

  await caller.decision.transitionFromPhase({ instanceId });
  await caller.decision.transitionFromPhase({ instanceId });
  await caller.decision.submitManualSelection({
    processInstanceId: instanceId,
    proposalIds: [proposal.id],
  });

  return { setup, instanceId, proposal, caller };
}

describe.concurrent('getInstanceResults', () => {
  it('returns previewText on result items so the results page can render card excerpts', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { caller, instanceId } = await createInstanceWithSelectedProposal(
      testData,
      task.id,
    );

    const result = await caller.decision.getInstanceResults({
      instanceId,
    });

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    // The legacy encoder must pass previewText through — list-shaped reads no
    // longer ship documentContent, so stripping it blanks every results card.
    expect(item?.previewText).toBe('This is rich content');
    expect(item?.documentContent).toBeUndefined();
  });

  it('returns the selected proposals to a no-JWT visitor on a public decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, proposal } =
      await createInstanceWithSelectedProposal(testData, task.id);

    await testData.makeDecisionPublic(setup.instance.profileId);

    const publicCaller = createCaller(await createTestContextWithSession(null));
    const result = await publicCaller.decision.getInstanceResults({
      instanceId,
    });

    expect(result.items.map((item) => item.id)).toEqual([proposal.id]);
  });

  it('returns the selected proposals to a logged-in user outside the network on a public decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, proposal } =
      await createInstanceWithSelectedProposal(testData, task.id);

    await testData.makeDecisionPublic(setup.instance.profileId);

    const caller = await createGatingCallers(onTestFinished).userJwt();
    const result = await caller.decision.getInstanceResults({ instanceId });

    expect(result.items.map((item) => item.id)).toEqual([proposal.id]);
  });

  it('returns the selected proposals to an anonymous session on a public decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, proposal } =
      await createInstanceWithSelectedProposal(testData, task.id);

    await testData.makeDecisionPublic(setup.instance.profileId);

    const caller = await createGatingCallers(onTestFinished).anonJwt();
    const result = await caller.decision.getInstanceResults({ instanceId });

    expect(result.items.map((item) => item.id)).toEqual([proposal.id]);
  });
});

describeDecisionAccessTierGating('getInstanceResults', {
  noJwtNonPublic: accessTierGatingCell(
    'admits no-JWT caller past the tier gate and denies them on a non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.noJwt();

      await expect(
        caller.decision.getInstanceResults({
          instanceId: instance.instance.id,
        }),
      ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'admits anon-JWT caller past the tier gate and denies them on a non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.anonJwt();

      await expect(
        caller.decision.getInstanceResults({
          instanceId: instance.instance.id,
        }),
      ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'admits user-JWT caller past the tier gate and denies them on a non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.userJwt();

      await expect(
        caller.decision.getInstanceResults({
          instanceId: instance.instance.id,
        }),
      ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.networkJwt(setup.userEmail);

      await expect(
        caller.decision.getInstanceResults({
          instanceId: instance.instance.id,
        }),
      ).rejects.toMatchObject({
        cause: { name: 'NotFoundError' },
      });
    },
  ),
});
