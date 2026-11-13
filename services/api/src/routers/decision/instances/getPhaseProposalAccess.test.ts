import {
  TestDecisionsDataManager,
  createDevelopPhaseSetup,
  createDevelopProposalsMember,
  testDevelopSchema,
} from '@op/common/testing';
import { ProcessStatus } from '@op/db/schema';
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

describe.concurrent('getPhaseProposalAccess', () => {
  it('gives an admin both submit and develop access in a develop phase that also allows submissions', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createDevelopPhaseSetup({ testData });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.getPhaseProposalAccess({ processInstanceId: instanceId }),
    ).resolves.toEqual({ canSubmit: true, canDevelop: true });
  });

  it('gives a Develop Proposals holder develop access but not submit access', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createDevelopPhaseSetup({ testData });
    const developer = await createDevelopProposalsMember({ testData, setup });
    const caller = await createAuthenticatedCaller(developer.email);

    await expect(
      caller.decision.getPhaseProposalAccess({ processInstanceId: instanceId }),
    ).resolves.toEqual({ canSubmit: false, canDevelop: true });
  });

  it('gives a participant submit access but not develop access', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createDevelopPhaseSetup({ testData });
    const participant = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });
    const caller = await createAuthenticatedCaller(participant.email);

    await expect(
      caller.decision.getPhaseProposalAccess({ processInstanceId: instanceId }),
    ).resolves.toEqual({ canSubmit: true, canDevelop: false });
  });

  it('gives a Develop Proposals holder no develop access outside a develop phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      processSchema: testDevelopSchema,
      status: ProcessStatus.PUBLISHED,
    });
    const developer = await createDevelopProposalsMember({ testData, setup });
    const caller = await createAuthenticatedCaller(developer.email);

    await expect(
      caller.decision.getPhaseProposalAccess({
        processInstanceId: setup.instance.instance.id,
      }),
    ).resolves.toEqual({ canSubmit: false, canDevelop: false });
  });
});
