import { ProposalStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  createIsolatedSession,
  createIsolatedTestClient,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

async function createAnonymousCaller() {
  const client = createIsolatedTestClient();
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.session) {
    throw new Error(`Failed to sign in anonymously: ${error?.message}`);
  }
  return createCaller(await createTestContextWithSession(data.session));
}

async function createUnauthenticatedCaller() {
  return createCaller(await createTestContextWithSession(null));
}

describe.concurrent('createProposal', () => {
  it('creates a draft proposal for an authenticated user', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.createProposal({
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Authenticated baseline' },
    });

    expect(result.status).toBe(ProposalStatus.DRAFT);
    if (result.profileId) {
      testData.trackProfileForCleanup(result.profileId);
    }
  });

  // Public-mode gating: createProposal admits anonymous-JWT callers via the
  // synth `Anonymous` role and rejects no-JWT callers via the synth
  // `Public` role (which lacks SUBMIT_PROPOSALS). Non-public instances
  // reject both at the standard role check.
  describe('public-mode gating', () => {
    it('creates a draft proposal as an anonymous participant on a public instance', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instances[0];
      if (!instance) {
        throw new Error('No instance created');
      }
      await testData.setInstancePublic(instance.instance.id);

      const anon = await testData.createAnonymousParticipant({ instance });

      const anonCaller = createCaller(
        await createTestContextWithSession(anon.session),
      );

      const result = await anonCaller.decision.createProposal({
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Created by anon owner' },
      });

      expect(result.status).toBe(ProposalStatus.DRAFT);
      if (result.profileId) {
        testData.trackProfileForCleanup(result.profileId);
      }
    });

    it('rejects a no-JWT request on a public instance', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instances[0];
      if (!instance) {
        throw new Error('No instance created');
      }
      await testData.setInstancePublic(instance.instance.id);

      const caller = await createUnauthenticatedCaller();

      // createProposal requires a real Supabase user (for proposal
      // ownership). No-JWT callers arrive with `authContext.user`
      // undefined and the service throws `UnauthorizedError` before
      // reaching the role check.
      await expect(
        caller.decision.createProposal({
          processInstanceId: instance.instance.id,
          proposalData: { title: 'Should reject no-JWT create' },
        }),
      ).rejects.toMatchObject({
        cause: { name: 'UnauthorizedError' },
      });
    });

    it('rejects an anonymous JWT on a non-public instance', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instances[0];
      if (!instance) {
        throw new Error('No instance created');
      }
      // Non-public by default — closed-network gate.

      const anonCaller = await createAnonymousCaller();

      await expect(
        anonCaller.decision.createProposal({
          processInstanceId: instance.instance.id,
          proposalData: { title: 'Non-public; anon should bounce' },
        }),
      ).rejects.toMatchObject({
        cause: { name: 'UnauthorizedError' },
      });
    });
  });
});
