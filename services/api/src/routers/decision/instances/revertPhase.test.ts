import { revertPhase } from '@op/common';
import { TestDecisionsDataManager } from '@op/common/testing';
import { ProcessStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import {
  listPhaseIds,
  loadBlobPhases,
  loadInstanceData,
  loadTransitionLinks,
  setupPublishedDateDecision,
} from '../../../test/helpers/phaseTestUtils';

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

  it('reverts a decision that has phase rows and leaves its transition links and blob alone', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, instanceId, initial, final } =
      await setupPublishedDateDecision(task, onTestFinished);
    const blobPhases = await loadBlobPhases(instanceId);
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
    expect(await loadBlobPhases(instanceId)).toEqual(blobPhases);
  });
});
