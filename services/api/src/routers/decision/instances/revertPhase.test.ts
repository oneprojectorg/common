import { revertPhase } from '@op/common';
import { TestDecisionsDataManager, emptyBlobPhases } from '@op/common/testing';
import { ProcessStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

describe.concurrent('revertPhase', () => {
  it('reverts to the previous phase the rows list when the blob holds no phases', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instance.instance.id;

    const advanced = await testData.advancePhase({
      instanceId,
      fromPhaseId: 'initial',
      toPhaseId: 'final',
    });
    expect(advanced.conflict).toBe(false);
    await emptyBlobPhases(instanceId);

    const result = await revertPhase({ instanceId, fromPhaseId: 'final' });

    expect(result.currentPhaseId).toBe('initial');
  });
});
