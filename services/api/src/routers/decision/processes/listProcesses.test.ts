import { expect } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { describeDecisionGating } from '../../../test/helpers/gating/decision';

describeDecisionGating('listProcesses', {
  noJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await callers.noJwt();

    await expect(caller.decision.listProcesses({})).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
    });
  },

  anonJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await callers.anonJwt();

    await expect(caller.decision.listProcesses({})).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
    });
  },

  userJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await callers.userJwt();

    await expect(caller.decision.listProcesses({})).rejects.toMatchObject({
      cause: { name: 'AuthGateError' },
    });
  },

  networkJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await callers.networkJwt(setup.userEmail);

    const result = await caller.decision.listProcesses({});
    expect(result.processes).toBeDefined();
  },
});
