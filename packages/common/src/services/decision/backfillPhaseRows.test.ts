import { TestDecisionsDataManager } from '@op/common/testing';
import { asc, db, eq, sql } from '@op/db/client';
import {
  EntityType,
  decisionProcessTransitions,
  processInstances,
  processPhases,
  profiles,
} from '@op/db/schema';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const backfillSql = readFileSync(
  new URL(
    '../../../../../services/db/migrations/20261028205217_backfill-phase-rows/migration.sql',
    import.meta.url,
  ),
  'utf8',
);

const proposalTemplate = {
  type: 'object',
  properties: { title: { type: 'string' } },
};

describe.concurrent('backfill-phase-rows migration', () => {
  it('given a decision with phases only in instance data, then it gets a row and profile per phase, linked transitions and the process proposal template, and a second run changes nothing', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      proposalTemplate,
    });
    const instanceId = setup.instance.instance.id;

    const { proposalTemplate: _template, ...instanceData } =
      setup.instance.instance.instanceData;
    const phases = instanceData.phases.map((phase) =>
      phase.phaseId === 'final' ? { ...phase, name: '  ' } : phase,
    );
    await db
      .update(processInstances)
      .set({ instanceData: { ...instanceData, phases } })
      .where(eq(processInstances.id, instanceId));

    await db
      .insert(decisionProcessTransitions)
      .values([
        transition(instanceId, null, 'initial'),
        transition(instanceId, 'initial', 'final'),
        transition(instanceId, 'final', 'ghost'),
      ]);

    await runBackfill([instanceId]);
    const rows = await readPhaseRows(instanceId);
    rows.forEach((row) => testData.trackProfileForCleanup(row.profileId));

    expect(rows.map((row) => row.sortOrder)).toEqual([0, 1]);
    expect(rows.map((row) => row.name)).toEqual(['Initial Phase', 'final']);
    expect(rows.map((row) => row.data)).toEqual(
      phases.map(({ name: _name, ...data }) => data),
    );
    for (const row of rows) {
      expect(row.type).toBe(EntityType.PHASE);
      expect(row.slug).toMatch(/^[0-9a-f]{8}$/);
    }

    const [initialRow, finalRow] = rows;
    const transitions = await readTransitions(instanceId);
    expect(transitions).toEqual([
      {
        fromStateId: 'initial',
        toStateId: 'final',
        fromPhaseId: initialRow?.id,
        toPhaseId: finalRow?.id,
      },
      {
        fromStateId: 'final',
        toStateId: 'ghost',
        fromPhaseId: finalRow?.id,
        toPhaseId: null,
      },
      {
        fromStateId: null,
        toStateId: 'initial',
        fromPhaseId: null,
        toPhaseId: initialRow?.id,
      },
    ]);

    const instanceAfter = await readInstanceData(instanceId);
    expect(instanceAfter).toMatchObject({ proposalTemplate });

    await runBackfill([instanceId]);

    expect(await readPhaseRows(instanceId)).toEqual(rows);
    expect(await readTransitions(instanceId)).toEqual(transitions);
    expect(await readInstanceData(instanceId)).toEqual(instanceAfter);
  });

  it('given a decision whose phases repeat a phaseId, then it is skipped', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      proposalTemplate,
    });
    const instanceId = setup.instance.instance.id;

    const { proposalTemplate: _template, ...instanceData } =
      setup.instance.instance.instanceData;
    await db
      .update(processInstances)
      .set({
        instanceData: {
          ...instanceData,
          phases: instanceData.phases.map((phase) => ({
            ...phase,
            phaseId: 'initial',
          })),
        },
      })
      .where(eq(processInstances.id, instanceId));
    await db
      .insert(decisionProcessTransitions)
      .values(transition(instanceId, 'initial', 'initial'));
    const instanceBefore = await readInstanceData(instanceId);

    await runBackfill([instanceId]);

    expect(await readPhaseRows(instanceId)).toEqual([]);
    expect(await readTransitions(instanceId)).toEqual([
      {
        fromStateId: 'initial',
        toStateId: 'initial',
        fromPhaseId: null,
        toPhaseId: null,
      },
    ]);
    expect(await readInstanceData(instanceId)).toEqual(instanceBefore);
  });
});

// The migration reads this setting so a run touches only this test's decisions.
const runBackfill = (instanceIds: string[]) =>
  db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('op_backfill.instance_ids', ${`{${instanceIds.join(',')}}`}, true)`,
    );
    await tx.execute(sql.raw(backfillSql));
  });

const transition = (
  processInstanceId: string,
  fromStateId: string | null,
  toStateId: string,
) => ({
  processInstanceId,
  fromStateId,
  toStateId,
  scheduledDate: new Date().toISOString(),
});

const readPhaseRows = (processInstanceId: string) =>
  db
    .select({
      id: processPhases.id,
      sortOrder: processPhases.sortOrder,
      data: processPhases.data,
      profileId: processPhases.profileId,
      name: profiles.name,
      slug: profiles.slug,
      type: profiles.type,
    })
    .from(processPhases)
    .innerJoin(profiles, eq(profiles.id, processPhases.profileId))
    .where(eq(processPhases.processInstanceId, processInstanceId))
    .orderBy(asc(processPhases.sortOrder));

const readTransitions = (processInstanceId: string) =>
  db
    .select({
      fromStateId: decisionProcessTransitions.fromStateId,
      toStateId: decisionProcessTransitions.toStateId,
      fromPhaseId: decisionProcessTransitions.fromPhaseId,
      toPhaseId: decisionProcessTransitions.toPhaseId,
    })
    .from(decisionProcessTransitions)
    .where(eq(decisionProcessTransitions.processInstanceId, processInstanceId))
    .orderBy(asc(decisionProcessTransitions.toStateId));

const readInstanceData = async (instanceId: string): Promise<unknown> => {
  const [instance] = await db
    .select({ instanceData: processInstances.instanceData })
    .from(processInstances)
    .where(eq(processInstances.id, instanceId));
  return instance?.instanceData;
};
