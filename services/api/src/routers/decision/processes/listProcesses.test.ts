import { expect } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  describeDecisionAccessTierGating,
  expectFailsTierGate,
} from '../../../test/helpers/gating/decision';

describeDecisionAccessTierGating('listProcesses', {
  noJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await callers.noJwt();

    await expectFailsTierGate(caller.decision.listProcesses({}), 'none');
  },

  anonJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await callers.anonJwt();

    await expectFailsTierGate(caller.decision.listProcesses({}), 'anon');
  },

  userJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await callers.userJwt();

    await expectFailsTierGate(caller.decision.listProcesses({}), 'user');
  },

  networkJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await callers.networkJwt(setup.userEmail);

    const result = await caller.decision.listProcesses({});
    expect(result.processes).toBeDefined();
  },
});
