import { expect } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { describeDecisionGating } from '../../../test/helpers/gating/decision';

// Network gating matrix: getInstanceResults sits on `commonAuthedProcedure`,
// which rejects no-JWT and anon-JWT at the auth middleware. Common-JWT
// owner is admitted; with no results recorded the procedure throws
// NotFoundError — distinct from the UnauthorizedError gate rejection.
describeDecisionGating('getInstanceResults', {
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
      caller.decision.getInstanceResults({ instanceId: instance.instance.id }),
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
      caller.decision.getInstanceResults({ instanceId: instance.instance.id }),
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

    const caller = await callers.existingJwt(setup.userEmail);

    await expect(
      caller.decision.getInstanceResults({ instanceId: instance.instance.id }),
    ).rejects.toMatchObject({
      cause: { name: 'NotFoundError' },
    });
  },
});
