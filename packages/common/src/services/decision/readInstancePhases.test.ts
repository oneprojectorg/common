import { TestDecisionsDataManager, emptyBlobPhases } from '@op/common/testing';
import { db, eq, sql } from '@op/db/client';
import { processInstances, processPhases } from '@op/db/schema';
import { logger } from '@op/logging';
import { describe, expect, it } from 'vitest';

import { insertPhase, listPhases, phaseIdOf } from './phaseHelpers';
import {
  readInstancePhases,
  withInstancePhases,
  withInstancesPhases,
} from './readInstancePhases';

const expectNoRowsWarning = (processInstanceIds: string[]) =>
  expect(logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('no phase rows'),
    { processInstanceIds },
  );

describe('readInstancePhases', () => {
  it('reads the rows in sort order', async ({ task, onTestFinished }) => {
    const { instanceId } = await createInstance(task.id, onTestFinished);
    await renameBlobPhases(instanceId);
    const rows = await loadRows(instanceId);
    await setSortOrder(rows.initial.id, 1);
    await setSortOrder(rows.final.id, 0);

    const phases = await readInstancePhases({
      db,
      processInstanceId: instanceId,
    });

    expect(phases.map(({ phaseId, name }) => ({ phaseId, name }))).toEqual([
      { phaseId: 'final', name: 'Final Phase' },
      { phaseId: 'initial', name: 'Initial Phase' },
    ]);
    expect(phases[1]?.rules?.proposals?.submit).toBe(true);
    expect(logger.warn).not.toHaveBeenCalledWith(
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

    const phases = await readInstancePhases({
      db,
      processInstanceId: instanceId,
    });

    expect(phases.map(({ phaseId }) => phaseId)).toEqual([
      'initial',
      rows.final.slug,
    ]);
  });

  it('keeps the row with the lowest sortOrder when two share a phase id, and warns', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId } = await createInstance(task.id, onTestFinished);
    const rows = await loadRows(instanceId);
    await setSortOrder(rows.initial.id, 3);
    await db.transaction((tx) =>
      insertPhase({
        tx,
        processInstanceId: instanceId,
        name: 'Duplicate initial',
        sortOrder: 2,
        data: { phaseId: 'initial' },
      }),
    );

    const phases = await readInstancePhases({
      db,
      processInstanceId: instanceId,
    });

    expect(phases.map(({ phaseId, name }) => ({ phaseId, name }))).toEqual([
      { phaseId: 'final', name: 'Final Phase' },
      { phaseId: 'initial', name: 'Duplicate initial' },
    ]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('two phase rows'),
      { processInstanceId: instanceId, phaseIds: ['initial'] },
    );
  });

  it('reads a list in one pass, gives [] to the instances without rows and warns once', async ({
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
    await testData.removePhaseRows(withoutRows);
    await emptyBlobPhases(withRows);
    const instances = [
      await loadInstance(withRows),
      await loadInstance(withoutRows),
    ];

    const [first, second] = await withInstancesPhases({ instances });

    expect(first?.instanceData).toMatchObject({
      phases: [{ phaseId: 'initial' }, { phaseId: 'final' }],
    });
    expect(second?.instanceData).toMatchObject({ phases: [] });
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expectNoRowsWarning([withoutRows]);
  });

  it('puts the rows on instanceData over the blob and keeps its other keys', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId } = await createInstance(task.id, onTestFinished);
    await renameBlobPhases(instanceId);
    const instance = await loadInstance(instanceId);

    const resolved = await withInstancePhases({ instance });

    expect(resolved.instanceData).toMatchObject({
      templateId: expect.any(String),
      phases: [
        { phaseId: 'initial', name: 'Initial Phase' },
        { phaseId: 'final', name: 'Final Phase' },
      ],
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
  const rows = await listPhases({ db, processInstanceId: instanceId });
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
