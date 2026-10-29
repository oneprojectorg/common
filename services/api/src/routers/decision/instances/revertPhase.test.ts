import {
  type DecisionInstanceData,
  advancePhase,
  revertPhase,
} from '@op/common';
import { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
import { ProcessStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

describe.concurrent('revertPhase', () => {
  it('reverts a decision that has no phase rows without creating any', async ({
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
    const instance = await db.query.processInstances.findFirst({
      where: { id: instanceId },
    });
    if (!instance) {
      throw new Error('Failed to reload instance');
    }
    await testData.removePhaseRows(instanceId);

    const advanced = await db.transaction((tx) =>
      advancePhase({
        db: tx,
        instance: {
          id: instanceId,
          instanceData: instance.instanceData as DecisionInstanceData,
        },
        fromPhaseId: 'initial',
        toPhaseId: 'final',
        triggeredByProfileId: null,
      }),
    );
    expect(advanced.conflict).toBe(false);

    const result = await revertPhase({ instanceId, fromPhaseId: 'final' });

    expect(result.currentPhaseId).toBe('initial');
    const rows = await db.query.processPhases.findMany({
      where: { processInstanceId: instanceId },
      columns: { id: true },
    });
    expect(rows).toHaveLength(0);
  });
});
