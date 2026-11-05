import { cache } from '@op/cache';
import { TestDecisionsDataManager } from '@op/common/testing';
import { ProposalStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating/decision';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

const readCachedUser = ({
  authUserId,
  fresh,
}: {
  authUserId: string;
  fresh: string;
}) => cache({ type: 'user', params: [authUserId], fetch: async () => fresh });

describe.concurrent('createProposal', () => {
  it('drops the cached access of the author so their admin role on the proposal applies at once', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const { session } = await createIsolatedSession(setup.userEmail);
    const caller = createCaller(await createTestContextWithSession(session));
    // A `user` entry cached before the membership exists.
    await readCachedUser({ authUserId: session.user.id, fresh: 'stale' });

    const proposal = await caller.decision.createProposal({
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: 'Cache Proposal' },
    });
    testData.trackProfileForCleanup(proposal.profileId);

    expect(
      await readCachedUser({ authUserId: session.user.id, fresh: 'fresh' }),
    ).toBe('fresh');
  });
});

describeDecisionAccessTierGating('createProposal', {
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
        caller.decision.createProposal({
          processInstanceId: instance.instance.id,
          proposalData: { title: 'Should reject no-JWT create' },
        }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'admits anon-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.anonJwt();

      await expectPassesAccessTierGate(
        caller.decision.createProposal({
          processInstanceId: instance.instance.id,
          proposalData: { title: 'Non-public; anon should bounce' },
        }),
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'admits user-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.userJwt();

      await expectPassesAccessTierGate(
        caller.decision.createProposal({
          processInstanceId: instance.instance.id,
          proposalData: { title: 'Non-public; anon should bounce' },
        }),
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

      const result = await caller.decision.createProposal({
        processInstanceId: instance.instance.id,
        proposalData: {
          title: 'Created by common admin on non-public instance',
        },
      });

      expect(result.status).toBe(ProposalStatus.DRAFT);
      if (result.profileId) {
        testData.trackProfileForCleanup(result.profileId);
      }
    },
  ),
});
