import { TestDecisionsDataManager } from '@op/common/testing';
import { db, eq, sql } from '@op/db/client';
import { processInstances, processPhases, profiles } from '@op/db/schema';
import { logger } from '@op/logging';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { insertPhase } from './phaseHelpers';
import {
  readInstancePhases,
  withInstancePhases,
  withInstancesPhases,
} from './readInstancePhases';

const forceFlagOn = () => vi.stubEnv('NEXT_PUBLIC_E2E', 'true');
const forceFlagOff = () => vi.stubEnv('NEXT_PUBLIC_E2E', '');

const expectNoRowsWarning = (processInstanceIds: string[]) =>
  expect(logger.warn).toHaveBeenCalledWith(
    expect.stringContaining('no phase rows'),
    { processInstanceIds },
  );

// Not concurrent: the flag is forced through the environment.
describe('readInstancePhases', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads instanceData.phases while the flag is off', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId } = await createInstance(task.id, onTestFinished);
    await renameBlobPhases(instanceId);
    forceFlagOff();

    const phases = await readInstancePhases({
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
    const { instanceId } = await createInstance(task.id, onTestFinished);
    await renameBlobPhases(instanceId);
    const rows = await loadRows(instanceId);
    await setSortOrder(rows.initial.id, 1);
    await setSortOrder(rows.final.id, 0);
    forceFlagOn();

    const phases = await readInstancePhases({
      instance: await loadInstance(instanceId),
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
    forceFlagOn();

    const phases = await readInstancePhases({
      instance: await loadInstance(instanceId),
    });

    expect(phases.map(({ phaseId }) => phaseId)).toEqual([
      'initial',
      rows.final.slug,
    ]);
  });

  it('falls back to instanceData.phases and warns when there are no rows', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, testData } = await createInstance(
      task.id,
      onTestFinished,
    );
    await testData.removePhaseRows(instanceId);
    await renameBlobPhases(instanceId);
    forceFlagOn();

    const phases = await readInstancePhases({
      instance: await loadInstance(instanceId),
    });

    expect(phases.map(({ name }) => name)).toEqual([
      'Blob initial',
      'Blob final',
    ]);
    expectNoRowsWarning([instanceId]);
  });

  it('keeps the blob phases that have no row yet, in blob order', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId } = await createInstance(task.id, onTestFinished);
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
    forceFlagOn();

    const phases = await readInstancePhases({
      instance: await loadInstance(instanceId),
    });

    expect(phases.map(({ phaseId, name }) => ({ phaseId, name }))).toEqual([
      { phaseId: 'initial', name: 'Blob initial' },
      { phaseId: 'final', name: 'Final Phase' },
      { phaseId: added.slug, name: 'Added phase' },
    ]);
  });

  it('leaves the instance as it is when it has no rows', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, testData } = await createInstance(
      task.id,
      onTestFinished,
    );
    await testData.removePhaseRows(instanceId);
    const instance = await loadInstance(instanceId);
    forceFlagOn();

    expect(await withInstancePhases({ instance })).toBe(instance);
    expectNoRowsWarning([instanceId]);
  });

  it('reads a list in one pass and warns once for the instances without rows', async ({
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
    forceFlagOn();

    const [first, second] = await withInstancesPhases({ instances });

    expect(first?.instanceData).toMatchObject({
      phases: [{ phaseId: 'initial' }, { phaseId: 'final' }],
    });
    expect(second).toBe(instances[1]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expectNoRowsWarning([withoutRows]);
  });

  it('puts the rows on instanceData and keeps its other keys', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId } = await createInstance(task.id, onTestFinished);
    await emptyBlobPhases(instanceId);
    const instance = await loadInstance(instanceId);
    forceFlagOff();

    expect(await withInstancePhases({ instance })).toBe(instance);

    forceFlagOn();
    const resolved = await withInstancePhases({ instance });

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
  const rows = await db
    .select({
      id: processPhases.id,
      profileId: processPhases.profileId,
      phaseId: sql<string | null>`${processPhases.data} ->> 'phaseId'`,
      slug: profiles.slug,
    })
    .from(processPhases)
    .innerJoin(profiles, eq(profiles.id, processPhases.profileId))
    .where(eq(processPhases.processInstanceId, instanceId));

  const initial = rows.find((row) => row.phaseId === 'initial');
  const final = rows.find((row) => row.phaseId === 'final');

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

const emptyBlobPhases = (instanceId: string) =>
  db
    .update(processInstances)
    .set({
      instanceData: sql`jsonb_set(${processInstances.instanceData}, '{phases}', '[]')`,
    })
    .where(eq(processInstances.id, instanceId));
