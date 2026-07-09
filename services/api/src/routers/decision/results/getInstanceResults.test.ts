import { ProcessStatus, ProposalStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
} from '../../../test/helpers/gating/decision';
import { schemaWithoutPipeline } from '../../../test/helpers/pipelineSchemas';
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

describe.concurrent('getInstanceResults', () => {
  it('returns previewText on result items so the results page can render card excerpts', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

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
        title: `Selected Proposal ${task.id}`,
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
});

describeDecisionAccessTierGating('getInstanceResults', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.getInstanceResults({
          instanceId: instance.instance.id,
        }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'rejects anon-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.anonJwt();

      await expectFailsAccessTierGate(
        caller.decision.getInstanceResults({
          instanceId: instance.instance.id,
        }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'rejects user-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.userJwt();

      await expectFailsAccessTierGate(
        caller.decision.getInstanceResults({
          instanceId: instance.instance.id,
        }),
        'user',
      );
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
