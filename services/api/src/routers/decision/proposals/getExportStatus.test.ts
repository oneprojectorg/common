import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  describeDecisionAccessTierGating,
  expectFailsTierGate,
} from '../../../test/helpers/gating/decision';

describeDecisionAccessTierGating('getExportStatus', {
  noJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await callers.noJwt();

    await expectFailsTierGate(
      caller.decision.getExportStatus({ exportId: randomUUID() }),
      'none',
    );
  },

  anonJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await callers.anonJwt();

    await expectFailsTierGate(
      caller.decision.getExportStatus({ exportId: randomUUID() }),
      'anon',
    );
  },

  userJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await callers.userJwt();

    await expectFailsTierGate(
      caller.decision.getExportStatus({ exportId: randomUUID() }),
      'user',
    );
  },

  networkJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await callers.networkJwt(setup.userEmail);

    const result = await caller.decision.getExportStatus({
      exportId: randomUUID(),
    });
    expect(result.status).toBe('not_found');
  },
});
