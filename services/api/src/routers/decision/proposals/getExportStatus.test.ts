import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { describeDecisionGating } from '../../../test/helpers/gating/decision';

// Network gating matrix: getExportStatus sits on `commonAuthedProcedure`,
// which rejects no-JWT and anon-JWT at the auth middleware. Common-JWT
// caller is admitted; a non-existent exportId returns { status: 'not_found' }.
describeDecisionGating('getExportStatus', {
  noJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await callers.noJwt();

    await expect(
      caller.decision.getExportStatus({ exportId: randomUUID() }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  anonJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await callers.anonJwt();

    await expect(
      caller.decision.getExportStatus({ exportId: randomUUID() }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await callers.existingJwt(setup.userEmail);

    const result = await caller.decision.getExportStatus({
      exportId: randomUUID(),
    });
    expect(result.status).toBe('not_found');
  },
});
