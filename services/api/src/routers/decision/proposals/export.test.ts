import { expect } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { describeDecisionGating } from '../../../test/helpers/gating/decision';

// Network gating matrix: export sits on `commonAuthedProcedure`, which
// rejects no-JWT and anon-JWT at the auth middleware. Common-JWT owner
// is admitted and gets back an exportId.
describeDecisionGating('export', {
  noJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const caller = await callers.noJwt();

    await expect(
      caller.decision.export({
        processInstanceId: instance.instance.id,
        format: 'csv',
        dir: 'desc',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  anonJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const caller = await callers.anonJwt();

    await expect(
      caller.decision.export({
        processInstanceId: instance.instance.id,
        format: 'csv',
        dir: 'desc',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const caller = await callers.networkJwt(setup.userEmail);

    const result = await caller.decision.export({
      processInstanceId: instance.instance.id,
      format: 'csv',
      dir: 'desc',
    });

    expect(result.exportId).toBeDefined();
  },
});
