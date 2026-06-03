import { expect } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  describeDecisionProcedureGating,
  expectFailsTierGate,
} from '../../../test/helpers/gating/decision';

describeDecisionProcedureGating('getInstanceResults', {
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

    await expectFailsTierGate(
      caller.decision.getInstanceResults({ instanceId: instance.instance.id }),
      'none',
    );
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

    await expectFailsTierGate(
      caller.decision.getInstanceResults({ instanceId: instance.instance.id }),
      'anon',
    );
  },

  userJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const caller = await callers.userJwt();

    await expectFailsTierGate(
      caller.decision.getInstanceResults({ instanceId: instance.instance.id }),
      'user',
    );
  },

  networkJwtNonPublic: async ({ task, onTestFinished, callers }) => {
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

    await expect(
      caller.decision.getInstanceResults({ instanceId: instance.instance.id }),
    ).rejects.toMatchObject({
      cause: { name: 'NotFoundError' },
    });
  },
});
