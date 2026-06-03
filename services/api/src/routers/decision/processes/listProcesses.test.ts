import { expect } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
} from '../../../test/helpers/gating/decision';

describeDecisionAccessTierGating('listProcesses', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      await testData.createDecisionSetup({ instanceCount: 0 });

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.listProcesses({}),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'rejects anon-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      await testData.createDecisionSetup({ instanceCount: 0 });

      const caller = await callers.anonJwt();

      await expectFailsAccessTierGate(
        caller.decision.listProcesses({}),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'rejects user-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      await testData.createDecisionSetup({ instanceCount: 0 });

      const caller = await callers.userJwt();

      await expectFailsAccessTierGate(
        caller.decision.listProcesses({}),
        'user',
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({ instanceCount: 0 });

      const caller = await callers.networkJwt(setup.userEmail);

      const result = await caller.decision.listProcesses({});
      expect(result.processes).toBeDefined();
    },
  ),
});
