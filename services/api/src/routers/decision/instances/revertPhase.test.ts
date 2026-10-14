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
  it('mints the phase rows of a decision that has none when it reverts', async ({
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

    const advanced = await db.transaction((tx) =>
      advancePhase({
        db: tx,
        instance: {
          id: instanceId,
          instanceData: instance!.instanceData as DecisionInstanceData,
        },
        fromPhaseId: 'initial',
        toPhaseId: 'final',
        triggeredByProfileId: null,
      }),
    );
    expect(advanced.conflict).toBe(false);
    await testData.removePhaseRows(instanceId);

    const result = await revertPhase({ instanceId, fromPhaseId: 'final' });

    expect(result.currentPhaseId).toBe('initial');
    const rows = await db.query.processPhases.findMany({
      where: { processInstanceId: instanceId },
      columns: { sortOrder: true },
    });
    expect(rows.map((row) => row.sortOrder).sort()).toEqual([0, 1]);
  });
});
