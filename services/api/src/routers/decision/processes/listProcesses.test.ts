import { expect } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { describeDecisionGating } from '../../../test/helpers/gating/decision';

// Network gating matrix: listProcesses sits on `commonAuthedProcedure`,
// which rejects no-JWT and anon-JWT at the auth middleware. Common-JWT
// caller is admitted and gets back the (possibly empty) process list.
describeDecisionGating('listProcesses', {
  noJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await callers.noJwt();

    await expect(caller.decision.listProcesses({})).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  anonJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await callers.anonJwt();

    await expect(caller.decision.listProcesses({})).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await callers.existingJwt(setup.userEmail);

    const result = await caller.decision.listProcesses({});
    expect(result.processes).toBeDefined();
  },
});
