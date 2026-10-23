import { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
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
  gating: '+15005550099',
  bind: '+15005550100',
  taken: '+15005550101',
} as const;

const gatingInput = {
  instanceId: crypto.randomUUID(),
  phoneNumber: NUMBERS.gating,
};

describeAccessTierGating('platform.admin.setDecisionChatLine', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.platform.admin.setDecisionChatLine(gatingInput),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.platform.admin.setDecisionChatLine(gatingInput),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'rejects user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectFailsAccessTierGate(
        caller.platform.admin.setDecisionChatLine(gatingInput),
        'user',
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.platform.admin.setDecisionChatLine(gatingInput),
      );
    },
  ),
});

describe.concurrent('platform.admin.setDecisionChatLine', () => {
  it('given a platform admin, when they bind a number, then the decision detail shows it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });
    const instanceId = setup.instance.instance.id;
    const { session } = await createIsolatedSession(setup.userEmail);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.platform.admin.setDecisionChatLine({
      instanceId,
      phoneNumber: NUMBERS.bind,
    });

    expect(result).toEqual({ phoneNumber: NUMBERS.bind });
    const detail = await caller.platform.admin.getDecisionInstance({
      instanceId,
    });
    expect(detail.chatLine).toBe(NUMBERS.bind);
  });

  it('given a number bound to another decision, when a platform admin binds it here, then the call fails and the number stays with the first decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 2 });
    const [holder, other] = setup.instances;
    if (!holder || !other) {
      throw new Error('expected two instances');
    }
    const { session } = await createIsolatedSession(setup.userEmail);
    const caller = createCaller(await createTestContextWithSession(session));
    await caller.platform.admin.setDecisionChatLine({
      instanceId: holder.instance.id,
      phoneNumber: NUMBERS.taken,
    });

    await expect(
      caller.platform.admin.setDecisionChatLine({
        instanceId: other.instance.id,
        phoneNumber: NUMBERS.taken,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ConflictError' } });

    const line = await db.query.decisionChatLines.findFirst({
      where: { phoneNumber: NUMBERS.taken },
      columns: { processInstanceId: true },
    });
    expect(line).toEqual({ processInstanceId: holder.instance.id });
  });
});
