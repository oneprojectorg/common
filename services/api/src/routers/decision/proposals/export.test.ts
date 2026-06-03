import { expect } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  describeDecisionAccessTierGating,
  expectFailsTierGate,
} from '../../../test/helpers/gating/decision';

describeDecisionAccessTierGating('export', {
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
      caller.decision.export({
        processInstanceId: instance.instance.id,
        format: 'csv',
        dir: 'desc',
      }),
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
      caller.decision.export({
        processInstanceId: instance.instance.id,
        format: 'csv',
        dir: 'desc',
      }),
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
      caller.decision.export({
        processInstanceId: instance.instance.id,
        format: 'csv',
        dir: 'desc',
      }),
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

    const result = await caller.decision.export({
      processInstanceId: instance.instance.id,
      format: 'csv',
      dir: 'desc',
    });

    expect(result.exportId).toBeDefined();
  },
});
