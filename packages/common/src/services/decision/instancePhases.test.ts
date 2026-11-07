import {
  TestDecisionsDataManager,
  emptyBlobPhases,
  loadPhaseRows,
} from '@op/common/testing';
import { db, eq, sql } from '@op/db/client';
import { processInstances, processPhases, profiles } from '@op/db/schema';
import { logger } from '@op/logging';
import { describe, expect, it } from 'vitest';

import {
  attachBlobPhases,
  getPhases,
  resolvePhases,
  resolvePhasesForAll,
} from './instancePhases';
import { insertPhase, phaseIdOf } from './phaseHelpers';
import { getInstancePhases } from './schemas/instanceData';

const expectNoRowsMessage = (processInstanceIds: string[]) =>
  expect(logger.debug).toHaveBeenCalledWith(
    expect.stringContaining('no phase rows'),
    { processInstanceIds },
  );

describe('instancePhases', () => {
  it('reads the rows in sort order over instanceData.phases', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId } = await createInstance(task.id, onTestFinished);
    await renameBlobPhases(instanceId);
    const rows = await loadRows(instanceId);
    await setSortOrder(rows.initial.id, 1);
    await setSortOrder(rows.final.id, 0);

    const phases = await getPhases({
      instance: await loadInstance(instanceId),
    });

    expect(phases.map(({ phaseId, name }) => ({ phaseId, name }))).toEqual([
      { phaseId: 'final', name: 'Final Phase' },
      { phaseId: 'initial', name: 'Initial Phase' },
    ]);
    expect(phases[1]?.rules?.proposals?.submit).toBe(true);
    expect(logger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining('no phase rows'),
      expect.anything(),
    );
  });

  it("takes a row's phaseId from its data, else from its profile slug", async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId } = await createInstance(task.id, onTestFinished);
    await emptyBlobPhases(instanceId);
    const rows = await loadRows(instanceId);
    await db
      .update(processPhases)
      .set({ data: sql`${processPhases.data} - 'phaseId'` })
      .where(eq(processPhases.id, rows.final.id));

    const phases = await getPhases({
      instance: await loadInstance(instanceId),
    });

    expect(phases.map(({ phaseId }) => phaseId)).toEqual([
      'initial',
      rows.final.slug,
    ]);
  });

  it('falls back to instanceData.phases and logs when there are no rows', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, testData } = await createInstance(
      task.id,
      onTestFinished,
    );
    await testData.removePhaseRows(instanceId);
    await renameBlobPhases(instanceId);

    const phases = await getPhases({
      instance: await loadInstance(instanceId),
    });

    expect(phases.map(({ name }) => name)).toEqual([
      'Blob initial',
      'Blob final',
    ]);
    expectNoRowsMessage([instanceId]);
  });

  it('reads only the rows, leaving out blob phases that have no row', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, testData } = await createInstance(
      task.id,
      onTestFinished,
    );
    await renameBlobPhases(instanceId);
    const rows = await loadRows(instanceId);
    await db.delete(profiles).where(eq(profiles.id, rows.initial.profileId));
    const { profile: added } = await db.transaction((tx) =>
      insertPhase({
        tx,
        processInstanceId: instanceId,
        name: 'Added phase',
        sortOrder: 2,
      }),
    );
    testData.trackProfileForCleanup(added.id);

    const phases = await getPhases({
      instance: await loadInstance(instanceId),
    });

    expect(phases.map(({ phaseId, name }) => ({ phaseId, name }))).toEqual([
      { phaseId: 'final', name: 'Final Phase' },
      { phaseId: added.slug, name: 'Added phase' },
    ]);
  });

  it('attaches the blob phases when it has no rows', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, testData } = await createInstance(
      task.id,
      onTestFinished,
    );
    await testData.removePhaseRows(instanceId);
    const instance = await loadInstance(instanceId);

    const resolved = await resolvePhases({ instance });

    expect(resolved.instanceData).toBe(instance.instanceData);
    expect(resolved.phases).toEqual(getInstancePhases(instance.instanceData));
    expectNoRowsMessage([instanceId]);
  });

  it('reads a list in one pass and logs once for the instances without rows', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 2 });
    const [withRows, withoutRows] = setup.instances.map(
      ({ instance }) => instance.id,
    );
    if (!withRows || !withoutRows) {
      throw new Error('Expected two instances');
    }
    await emptyBlobPhases(withRows);
    await testData.removePhaseRows(withoutRows);
    const instances = [
      await loadInstance(withRows),
      await loadInstance(withoutRows),
    ];

    const [first, second] = await resolvePhasesForAll({ instances });

    expect(first?.phases).toMatchObject([
      { phaseId: 'initial' },
      { phaseId: 'final' },
    ]);
    expect(first?.instanceData).toBe(instances[0]?.instanceData);
    expect(second?.phases).toEqual(
      getInstancePhases(instances[1]?.instanceData),
    );
    expect(second?.instanceData).toBe(instances[1]?.instanceData);
    expect(logger.debug).toHaveBeenCalledTimes(1);
    expectNoRowsMessage([withoutRows]);
  });

  it('attaches the rows as phases and never touches instanceData', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId } = await createInstance(task.id, onTestFinished);
    await emptyBlobPhases(instanceId);
    const instance = await loadInstance(instanceId);

    const resolved = await resolvePhases({ instance });

    expect(resolved.instanceData).toBe(instance.instanceData);
    expect(resolved.instanceData).toMatchObject({ phases: [] });
    expect(resolved.phases).toMatchObject([
      { phaseId: 'initial' },
      { phaseId: 'final' },
    ]);
  });

  it('attaches the blob phases even when rows exist', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId } = await createInstance(task.id, onTestFinished);
    await renameBlobPhases(instanceId);
    const instance = await loadInstance(instanceId);

    const attached = attachBlobPhases({ instance });

    expect(attached.instanceData).toBe(instance.instanceData);
    expect(attached.phases.map(({ name }) => name)).toEqual([
      'Blob initial',
      'Blob final',
    ]);
  });
});

async function createInstance(
  taskId: string,
  onTestFinished: (fn: () => void | Promise<void>) => void,
) {
  const testData = new TestDecisionsDataManager(taskId, onTestFinished);
  const setup = await testData.createDecisionSetup({ instanceCount: 1 });

  return { instanceId: setup.instance.instance.id, testData };
}

async function loadInstance(instanceId: string) {
  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
    columns: { id: true, instanceData: true },
  });

  if (!instance) {
    throw new Error(`Instance ${instanceId} not found`);
  }

  return instance;
}

async function loadRows(instanceId: string) {
  const rows = await loadPhaseRows(instanceId);
  const initial = rows.find((row) => phaseIdOf(row) === 'initial');
  const final = rows.find((row) => phaseIdOf(row) === 'final');

  if (!initial || !final) {
    throw new Error(`Instance ${instanceId} is missing its phase rows`);
  }

  return { initial, final };
}

const setSortOrder = (rowId: string, sortOrder: number) =>
  db
    .update(processPhases)
    .set({ sortOrder })
    .where(eq(processPhases.id, rowId));

const renameBlobPhases = (instanceId: string) =>
  db
    .update(processInstances)
    .set({
      instanceData: sql`jsonb_set(
        jsonb_set(${processInstances.instanceData}, '{phases,0,name}', '"Blob initial"'),
        '{phases,1,name}', '"Blob final"'
      )`,
    })
    .where(eq(processInstances.id, instanceId));
