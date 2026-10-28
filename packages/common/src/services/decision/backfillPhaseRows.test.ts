import { TestDecisionsDataManager } from '@op/common/testing';
import { asc, db, eq, inArray, sql } from '@op/db/client';
import {
  EntityType,
  decisionProcessTransitions,
  processInstances,
  processPhases,
  profiles,
} from '@op/db/schema';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import type { DecisionInstanceData } from './schemas/instanceData';

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

const ASTRAL = String.fromCodePoint(0x1f600);
const NBSP = String.fromCharCode(0xa0);
const IDEOGRAPHIC_SPACE = String.fromCharCode(0x3000);

describe.concurrent('backfill-phase-rows migration', () => {
  it('given a decision with phases only in instance data, then it gets a row and profile per phase, linked transitions and the process proposal template, and a second run changes nothing', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    let phases: DecisionInstanceData['phases'] = [];
    const instanceId = await seedDecision(testData, {
      proposalTemplate,
      instanceData: ({ proposalTemplate: _template, ...current }) => {
        phases = current.phases.map((phase) =>
          phase.phaseId === 'final' ? { ...phase, name: '  ' } : phase,
        );
        return { ...current, phases };
      },
    });

    await db
      .insert(decisionProcessTransitions)
      .values([
        transition(instanceId, null, 'initial'),
        transition(instanceId, 'initial', 'final'),
        transition(instanceId, 'final', 'ghost'),
      ]);

    await runBackfill(testData, instanceId);
    const rows = await readPhaseRows(instanceId);

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

    await runBackfill(testData, instanceId);

    expect(await readPhaseRows(instanceId)).toEqual(rows);
    expect(await readTransitions(instanceId)).toEqual(transitions);
    expect(await readInstanceData(instanceId)).toEqual(instanceAfter);
  });

  it('given a decision whose phases repeat a phaseId, then it is skipped', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const instanceId = await seedDecision(testData, {
      proposalTemplate,
      instanceData: ({ proposalTemplate: _template, ...current }) => ({
        ...current,
        phases: current.phases.map((phase) => ({
          ...phase,
          phaseId: 'initial',
        })),
      }),
    });
    await db
      .insert(decisionProcessTransitions)
      .values(transition(instanceId, 'initial', 'initial'));
    const instanceBefore = await readInstanceData(instanceId);

    await runBackfill(testData, instanceId);

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

  it('given 30 phases, then every phase gets a row', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const instanceId = await seedDecision(testData, {
      instanceData: (current) => ({ ...current, phases: numberedPhases(30) }),
    });

    await runBackfill(testData, instanceId);

    expect(await readPhaseRows(instanceId)).toHaveLength(30);
  });

  it('given 31 phases, then the decision is skipped', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const instanceId = await seedDecision(testData, {
      instanceData: (current) => ({ ...current, phases: numberedPhases(31) }),
    });

    await runBackfill(testData, instanceId);

    expect(await readPhaseRows(instanceId)).toEqual([]);
  });

  it('given a name of 256 astral code points, then the profile holds it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const name = ASTRAL.repeat(256);
    const instanceId = await seedDecision(testData, {
      instanceData: (current) => ({
        ...current,
        phases: [{ phaseId: 'long', name }],
      }),
    });

    await runBackfill(testData, instanceId);

    expect((await readPhaseRows(instanceId)).map((row) => row.name)).toEqual([
      name,
    ]);
  });

  it('given a name of 257 astral code points, then the decision is skipped', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const instanceId = await seedDecision(testData, {
      instanceData: (current) => ({
        ...current,
        phases: [{ phaseId: 'long', name: ASTRAL.repeat(257) }],
      }),
    });

    await runBackfill(testData, instanceId);

    expect(await readPhaseRows(instanceId)).toEqual([]);
  });

  it('given a name padded with NBSP and ideographic spaces, then it is trimmed like JS trim', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const name = `${NBSP}${IDEOGRAPHIC_SPACE} Review ${IDEOGRAPHIC_SPACE}${NBSP}`;
    const instanceId = await seedDecision(testData, {
      instanceData: (current) => ({
        ...current,
        phases: [{ phaseId: 'review', name }],
      }),
    });

    await runBackfill(testData, instanceId);

    const rows = await readPhaseRows(instanceId);
    expect(rows.map((row) => row.name)).toEqual([name.trim()]);
    expect(name.trim()).toBe('Review');
  });

  it('given a decision with its own proposal template, then the template is kept', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const ownTemplate = { type: 'object', title: 'Own form' };
    const instanceId = await seedDecision(testData, {
      proposalTemplate,
      instanceData: (current) => ({
        ...current,
        proposalTemplate: ownTemplate,
      }),
    });

    await runBackfill(testData, instanceId);

    expect(await readPhaseRows(instanceId)).toHaveLength(2);
    expect(await readInstanceData(instanceId)).toMatchObject({
      proposalTemplate: ownTemplate,
    });
  });

  it('given a process without a proposal template, then the decision gets rows and no template', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const instanceId = await seedDecision(testData, {});

    await runBackfill(testData, instanceId);

    expect(await readPhaseRows(instanceId)).toHaveLength(2);
    expect(await readInstanceData(instanceId)).not.toHaveProperty(
      'proposalTemplate',
    );
  });

  it('given an empty phaseId, then the decision is skipped', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const instanceId = await seedDecision(testData, {
      instanceData: (current) => ({
        ...current,
        phases: [...current.phases, { phaseId: '', name: 'Blank' }],
      }),
    });

    await runBackfill(testData, instanceId);

    expect(await readPhaseRows(instanceId)).toEqual([]);
  });

  it('given a phase that is not an object, then the decision is skipped', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const instanceId = await seedDecision(testData, {
      instanceData: (current) => ({
        ...current,
        phases: [...current.phases, 'results'],
      }),
    });

    await runBackfill(testData, instanceId);

    expect(await readPhaseRows(instanceId)).toEqual([]);
  });

  it('given rows that leave a phase uncovered, then the decision is skipped', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const instanceId = await seedDecision(testData, {});

    const [profile] = await db
      .insert(profiles)
      .values({
        type: EntityType.PHASE,
        name: 'Endpoint phase',
        slug: randomUUID().slice(0, 8),
      })
      .returning({ id: profiles.id });
    if (!profile) {
      throw new Error('Failed to create phase profile');
    }
    testData.trackProfileForCleanup(profile.id);
    await db
      .insert(processPhases)
      .values({
        processInstanceId: instanceId,
        sortOrder: 0,
        profileId: profile.id,
      });

    await runBackfill(testData, instanceId);

    expect(
      (await readPhaseRows(instanceId)).map((row) => row.profileId),
    ).toEqual([profile.id]);
  });
});

/**
 * A decision whose phases live only in instance data. Rows a newer
 * `createDecisionInstance` mints are removed, so the backfill has work to do.
 */
const seedDecision = async (
  testData: TestDecisionsDataManager,
  {
    proposalTemplate,
    instanceData,
  }: {
    proposalTemplate?: Record<string, unknown>;
    instanceData?: (current: DecisionInstanceData) => Record<string, unknown>;
  },
): Promise<string> => {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    proposalTemplate,
  });
  const { id, instanceData: current } = setup.instance.instance;

  if (instanceData) {
    await db
      .update(processInstances)
      .set({ instanceData: instanceData(current) })
      .where(eq(processInstances.id, id));
  }

  const minted = await db
    .select({ profileId: processPhases.profileId })
    .from(processPhases)
    .where(eq(processPhases.processInstanceId, id));
  if (minted.length > 0) {
    await db.delete(profiles).where(
      inArray(
        profiles.id,
        minted.map((row) => row.profileId),
      ),
    );
  }

  return id;
};

// The migration reads this setting so a run touches only this test's decision.
const runBackfill = async (
  testData: TestDecisionsDataManager,
  instanceId: string,
) => {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('op_backfill.instance_ids', ${`{${instanceId}}`}, true)`,
    );
    await tx.execute(sql.raw(backfillSql));
  });

  const rows = await readPhaseRows(instanceId);
  rows.forEach((row) => testData.trackProfileForCleanup(row.profileId));
};

const numberedPhases = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    phaseId: `phase-${index}`,
    name: `Phase ${index}`,
  }));

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
