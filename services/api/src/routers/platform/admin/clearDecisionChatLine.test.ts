import { TestDecisionsDataManager } from '@op/common/testing';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

const NUMBERS = {
  bound: '+15005550102',
} as const;

const gatingInput = { instanceId: crypto.randomUUID() };

describeAccessTierGating('platform.admin.clearDecisionChatLine', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.platform.admin.clearDecisionChatLine(gatingInput),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.platform.admin.clearDecisionChatLine(gatingInput),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'rejects user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectFailsAccessTierGate(
        caller.platform.admin.clearDecisionChatLine(gatingInput),
        'user',
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.platform.admin.clearDecisionChatLine(gatingInput),
      );
    },
  ),
});

describe.concurrent('platform.admin.clearDecisionChatLine', () => {
  it('given a bound decision, when a platform admin unbinds it, then the decision detail shows no line', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });
    const instanceId = setup.instance.instance.id;
    const { session } = await createIsolatedSession(setup.userEmail);
    const caller = createCaller(await createTestContextWithSession(session));
    await caller.platform.admin.setDecisionChatLine({
      instanceId,
      phoneNumber: NUMBERS.bound,
    });

    const result = await caller.platform.admin.clearDecisionChatLine({
      instanceId,
    });

    expect(result).toEqual({ cleared: true });
    const detail = await caller.platform.admin.getDecisionInstance({
      instanceId,
    });
    expect(detail.chatLine).toBeNull();
  });
});
