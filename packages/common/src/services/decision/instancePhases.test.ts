import {
  TestDecisionsDataManager,
  emptyBlobPhases,
  forceServerFlags,
} from '@op/common/testing';
import { db, eq, sql } from '@op/db/client';
import { processInstances, processPhases, profiles } from '@op/db/schema';
import { logger } from '@op/logging';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getPhases,
  resolvePhases,
  resolvePhasesForAll,
} from './instancePhases';
import { insertPhase, listPhasesByInstance, phaseIdOf } from './phaseHelpers';

const expectNoRowsMessage = (processInstanceIds: string[]) =>
  expect(logger.debug).toHaveBeenCalledWith(
    expect.stringContaining('no phase rows'),
    { processInstanceIds },
  );

describe('instancePhases', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads instanceData.phases while the flag is off, even with rows', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, testData } = await createInstance(
      task.id,
      onTestFinished,
    );
    await testData.createPhaseRows(instanceId);
    await renameBlobPhases(instanceId);
    forceServerFlags(false);

    const phases = await getPhases({
      instance: await loadInstance(instanceId),
    });

    expect(phases.map(({ phaseId, name }) => ({ phaseId, name }))).toEqual([
      { phaseId: 'initial', name: 'Blob initial' },
      { phaseId: 'final', name: 'Blob final' },
    ]);
  });

  it('reads the rows in sort order while the flag is on', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, testData } = await createInstance(
      task.id,
      onTestFinished,
    );
    await testData.createPhaseRows(instanceId);
    await renameBlobPhases(instanceId);
    const rows = await loadRows(instanceId);
    await setSortOrder(rows.initial.id, 1);
    await setSortOrder(rows.final.id, 0);
    forceServerFlags(true);

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
    const { instanceId, testData } = await createInstance(
      task.id,
      onTestFinished,
    );
    await testData.createPhaseRows(instanceId);
    await emptyBlobPhases(instanceId);
    const rows = await loadRows(instanceId);
    await db
      .update(processPhases)
      .set({ data: sql`${processPhases.data} - 'phaseId'` })
      .where(eq(processPhases.id, rows.final.id));
    forceServerFlags(true);

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
    const { instanceId } = await createInstance(task.id, onTestFinished);
    await renameBlobPhases(instanceId);
    forceServerFlags(true);

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
    await testData.createPhaseRows(instanceId);
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
    forceServerFlags(true);

    const phases = await getPhases({
      instance: await loadInstance(instanceId),
    });

    expect(phases.map(({ phaseId, name }) => ({ phaseId, name }))).toEqual([
      { phaseId: 'final', name: 'Final Phase' },
      { phaseId: added.slug, name: 'Added phase' },
    ]);
  });

  it('leaves the instance as it is when it has no rows', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId } = await createInstance(task.id, onTestFinished);
    const instance = await loadInstance(instanceId);
    forceServerFlags(true);

    expect((await resolvePhases({ instance })).instanceData).toBe(
      instance.instanceData,
    );
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
    await testData.createPhaseRows(withRows);
    await emptyBlobPhases(withRows);
    const instances = [
      await loadInstance(withRows),
      await loadInstance(withoutRows),
    ];
    forceServerFlags(true);

    const [first, second] = await resolvePhasesForAll({ instances });

    expect(first?.instanceData).toMatchObject({
      phases: [{ phaseId: 'initial' }, { phaseId: 'final' }],
    });
    expect(second?.instanceData).toBe(instances[1]?.instanceData);
    expect(logger.debug).toHaveBeenCalledTimes(1);
    expectNoRowsMessage([withoutRows]);
  });

  it('puts the rows on instanceData and keeps its other keys', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, testData } = await createInstance(
      task.id,
      onTestFinished,
    );
    await testData.createPhaseRows(instanceId);
    await emptyBlobPhases(instanceId);
    const instance = await loadInstance(instanceId);
    forceServerFlags(false);

    expect((await resolvePhases({ instance })).instanceData).toBe(
      instance.instanceData,
    );

    forceServerFlags(true);
    const resolved = await resolvePhases({ instance });

    expect(resolved.instanceData).toMatchObject({
      templateId: expect.any(String),
      phases: [{ phaseId: 'initial' }, { phaseId: 'final' }],
    });
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
  const phasesByInstance = await listPhasesByInstance({
    db,
    processInstanceIds: [instanceId],
  });
  const rows = phasesByInstance.get(instanceId) ?? [];
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
