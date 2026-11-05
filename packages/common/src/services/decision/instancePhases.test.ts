import { TestDecisionsDataManager } from '@op/common/testing';
import { db, eq, sql } from '@op/db/client';
import { processPhases, profiles } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import {
  getPhases,
  resolvePhases,
  resolvePhasesForAll,
} from './instancePhases';

describe('instancePhases', () => {
  it('reads the rows in sort order', async ({ task, onTestFinished }) => {
    const { instanceId } = await createInstance(task.id, onTestFinished);
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
  });

  it("takes a row's phaseId from its data, else from its profile slug", async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId } = await createInstance(task.id, onTestFinished);
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

  it('reads an instance with no rows as having no phases', async ({
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

    expect(resolved.phases).toEqual([]);
    expect(resolved.instanceData).toBe(instance.instanceData);
  });

  it('reads a list of instances in one pass, each with only its own rows', async ({
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
    const instances = [
      await loadInstance(withRows),
      await loadInstance(withoutRows),
    ];

    const [first, second] = await resolvePhasesForAll({ instances });

    expect(first?.phases).toMatchObject([
      { phaseId: 'initial' },
      { phaseId: 'final' },
    ]);
    expect(second?.phases).toEqual([]);
  });

  it('attaches the rows as phases and never touches instanceData', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId } = await createInstance(task.id, onTestFinished);
    const instance = await loadInstance(instanceId);

    const resolved = await resolvePhases({ instance });

    expect(instance.instanceData).not.toHaveProperty('phases');
    expect(resolved.instanceData).toBe(instance.instanceData);
    expect(resolved.phases).toMatchObject([
      { phaseId: 'initial' },
      { phaseId: 'final' },
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
