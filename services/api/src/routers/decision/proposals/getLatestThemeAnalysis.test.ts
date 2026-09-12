import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
} from '../../../test/helpers/gating/decision';

// Every refused tier below is refused before the instance is looked up, so the
// id only has to be well-formed. The admitted tier reads a real instance.
const latestInput = (processInstanceId: string = randomUUID()) => ({
  processInstanceId,
  scope: 'phase' as const,
});

describeDecisionAccessTierGating('getLatestThemeAnalysis', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      await testData.createDecisionSetup({ instanceCount: 0 });

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.getLatestThemeAnalysis(latestInput()),
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
        caller.decision.getLatestThemeAnalysis(latestInput()),
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
        caller.decision.getLatestThemeAnalysis(latestInput()),
        'user',
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({ instanceCount: 1 });

      const caller = await callers.networkJwt(setup.userEmail);

      // A fresh instance has never been analysed, so the admitted read is a
      // miss rather than a snapshot.
      const result = await caller.decision.getLatestThemeAnalysis(
        latestInput(setup.instance.instance.id),
      );

      expect(result.status).toBe('not_found');
    },
  ),
});
