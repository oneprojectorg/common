import { revertPhase } from '@op/common';
import { TestDecisionsDataManager } from '@op/common/testing';
import { ProcessStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { listPhaseIds } from '../../../test/helpers/phaseTestUtils';

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
    await testData.removePhaseRows(instanceId);

    const advanced = await testData.advancePhase({
      instanceId,
      fromPhaseId: 'initial',
      toPhaseId: 'final',
    });
    expect(advanced.conflict).toBe(false);

    const result = await revertPhase({ instanceId, fromPhaseId: 'final' });

    expect(result.currentPhaseId).toBe('initial');
    expect(await listPhaseIds(instanceId)).toEqual([]);
  });
});
