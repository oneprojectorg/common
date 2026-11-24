import { revertPhase } from '@op/common';
import { TestDecisionsDataManager, loadPhaseRows } from '@op/common/testing';
import { ProcessStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import {
  DAY_MS,
  listPhaseIds,
  loadBlobPhases,
  loadInstanceData,
  loadTransitionLinks,
  setupPublishedDateDecision,
  setupPublishedDecisionAtThirdPhase,
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

  it('unlocks every field of the phase it reverts from and keeps the phases before the new current one locked', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, adminCaller, rows } =
      await setupPublishedDecisionAtThirdPhase(task, onTestFinished);

    const result = await revertPhase({ instanceId, fromPhaseId: 'voting' });
    expect(result.currentPhaseId).toBe('review');

    // A new start date was refused while voting was the current phase.
    const startDate = new Date(Date.now() + 2.5 * DAY_MS).toISOString();
    await adminCaller.decision.updatePhase({
      phaseId: rows.voting.id,
      name: 'Ballot',
      data: { description: 'Pick one', startDate },
    });
    const rowsBefore = await loadPhaseRows(instanceId);
    expect(rowsBefore[2]).toMatchObject({
      id: rows.voting.id,
      name: 'Ballot',
      data: { description: 'Pick one', startDate },
    });

    await expect(
      adminCaller.decision.updatePhase({
        phaseId: rows.submission.id,
        data: { endDate: new Date(Date.now() + 20 * DAY_MS).toISOString() },
      }),
    ).rejects.toMatchObject({
      cause: {
        name: 'ValidationError',
        message: 'The past phase "Submission" cannot be edited',
      },
    });
    expect(await loadPhaseRows(instanceId)).toEqual(rowsBefore);
  });
});
