import { expect } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
} from '../../../test/helpers/gating/decision';

describeDecisionAccessTierGating('analyzeThemes', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.analyzeThemes({
          processInstanceId: setup.instance.instance.id,
        }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'rejects anon-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });

      const caller = await callers.anonJwt();

      await expectFailsAccessTierGate(
        caller.decision.analyzeThemes({
          processInstanceId: setup.instance.instance.id,
        }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'rejects user-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });

      const caller = await callers.userJwt();

      await expectFailsAccessTierGate(
        caller.decision.analyzeThemes({
          processInstanceId: setup.instance.instance.id,
        }),
        'user',
      );
    },
  ),

  // Past the access tier, and refused on its own terms: the setup's instance
  // holds no proposals, so there is nothing to compare. That is the answer an
  // admitted caller should get, and it costs no model call to give — which is
  // the whole reason the minimum is checked in the request rather than left to
  // the job.
  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });

      const caller = await callers.networkJwt(setup.userEmail);

      await expect(
        caller.decision.analyzeThemes({
          processInstanceId: setup.instance.instance.id,
        }),
      ).rejects.toThrow(/at least 2 proposals/);
    },
  ),
});
