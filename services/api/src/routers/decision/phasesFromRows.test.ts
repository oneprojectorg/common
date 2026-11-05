import {
  TestDecisionsDataManager,
  updateInstancePhases,
} from '@op/common/testing';
import { db, eq } from '@op/db/client';
import { processInstances } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { createAuthenticatedCaller } from '../../test/supabase-utils';

describe('phases read from rows', () => {
  it('reads no phases for a decision that has no phase rows', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;
    await testData.removePhaseRows(instanceId);

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const instance = await caller.decision.getInstance({ instanceId });

    expect(instance.instanceData.phases).toEqual([]);
  });
});

describe('getInstance with hideBudget', () => {
  it('strips phase budgets from the rows', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const { id: instanceId, instanceData } = setup.instance.instance;
    await db
      .update(processInstances)
      .set({
        instanceData: {
          ...instanceData,
          config: { ...instanceData.config, hideBudget: true },
        },
      })
      .where(eq(processInstances.id, instanceId));
    await updateInstancePhases({
      instanceId,
      update: (phases) =>
        phases.map((phase) => ({ ...phase, settings: { budget: 1000 } })),
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const instance = await caller.decision.getInstance({ instanceId });

    expect(
      instance.instanceData.phases?.map(({ settings }) => settings),
    ).toEqual([{}, {}]);
  });
});
