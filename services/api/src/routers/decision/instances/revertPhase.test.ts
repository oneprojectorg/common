import { revertPhase } from '@op/common';
import { TestDecisionsDataManager } from '@op/common/testing';
import { ProcessStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import {
  listPhaseIds,
  loadInstanceData,
  loadTransitionLinks,
  setupPublishedDateDecision,
} from '../../../test/helpers/phaseTestUtils';

describe.concurrent('revertPhase', () => {
  it('refuses to revert a decision whose phase rows are gone', async ({
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
    await testData.removePhaseRows(instanceId);

    await expect(
      revertPhase({ instanceId, fromPhaseId: 'final' }),
    ).rejects.toThrow('Phase initial is no longer defined');
    expect(await listPhaseIds(instanceId)).toEqual([]);
  });

  it('reverts a decision that has phase rows and leaves its transition links alone', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, instanceId, initial, final } =
      await setupPublishedDateDecision(task, onTestFinished);
    const links = await loadTransitionLinks(instanceId);
    expect(links).toMatchObject([
      { fromPhaseId: initial.id, toPhaseId: final.id },
    ]);

    const advanced = await testData.advancePhase({
      instanceId,
      fromPhaseId: 'initial',
      toPhaseId: 'final',
    });
    expect(advanced.conflict).toBe(false);
    expect((await loadInstanceData(instanceId)).instance.currentStateId).toBe(
      'final',
    );

    const result = await revertPhase({ instanceId, fromPhaseId: 'final' });

    expect(result.currentPhaseId).toBe('initial');
    expect((await loadInstanceData(instanceId)).instance.currentStateId).toBe(
      'initial',
    );
    expect(await loadTransitionLinks(instanceId)).toEqual(links);
    expect(await listPhaseIds(instanceId)).toHaveLength(2);
  });
});
