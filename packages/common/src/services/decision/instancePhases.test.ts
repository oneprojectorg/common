import { TestDecisionsDataManager } from '@op/common/testing';
import { db, eq, sql } from '@op/db/client';
import { processPhases, profiles } from '@op/db/schema';
import { logger } from '@op/logging';
import { describe, expect, it } from 'vitest';

import {
  attachBlobPhases,
  getPhases,
  resolvePhases,
  resolvePhasesForAll,
} from './instancePhases';
import { insertPhase } from './phaseHelpers';
import { getInstancePhases } from './schemas/instanceData';

const expectNoRowsMessage = (processInstanceIds: string[]) =>
  expect(logger.debug).toHaveBeenCalledWith(
    expect.stringContaining('no phase rows'),
    { processInstanceIds },
  );

describe('instancePhases', () => {
  it('reads the rows in sort order, ignoring the blob', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, testData } = await createInstance(
      task.id,
      onTestFinished,
    );
    await testData.createPhaseRows(instanceId);
    const rows = await loadRows(instanceId);
    await setSortOrder(rows.initial.id, 1);
    await setSortOrder(rows.final.id, 0);

    const phases = await getPhases({
      instance: await loadInstance(instanceId),
    });

    expect(phases.map(({ phaseId, name }) => ({ phaseId, name }))).toEqual([
      { phaseId: 'final', name: 'Row final' },
      { phaseId: 'initial', name: 'Row initial' },
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
    await testData.leaveOnlyPhaseRows(instanceId);
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
    const { instanceId } = await createInstance(task.id, onTestFinished);

    const phases = await getPhases({
      instance: await loadInstance(instanceId),
    });

    expect(phases.map(({ name }) => name)).toEqual([
      'Initial Phase',
      'Final Phase',
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
      { phaseId: 'final', name: 'Row final' },
      { phaseId: added.slug, name: 'Added phase' },
    ]);
  });

  it('attaches the blob phases when it has no rows', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId } = await createInstance(task.id, onTestFinished);
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
    await testData.leaveOnlyPhaseRows(withRows);
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
    const { instanceId, testData } = await createInstance(
      task.id,
      onTestFinished,
    );
    await testData.leaveOnlyPhaseRows(instanceId);
    const instance = await loadInstance(instanceId);

    const resolved = await resolvePhases({ instance });

    expect(resolved.instanceData).toBe(instance.instanceData);
    expect(resolved.instanceData).toMatchObject({ phases: [] });
    expect(resolved.phases).toMatchObject([
      { phaseId: 'initial' },
      { phaseId: 'final' },
    ]);
  });

  it('attaches the blob phases without reading the rows', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, testData } = await createInstance(
      task.id,
      onTestFinished,
    );
    await testData.createPhaseRows(instanceId);
    const instance = await loadInstance(instanceId);

    const attached = attachBlobPhases({ instance });

    expect(attached.instanceData).toBe(instance.instanceData);
    expect(attached.phases.map(({ name }) => name)).toEqual([
      'Initial Phase',
      'Final Phase',
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
