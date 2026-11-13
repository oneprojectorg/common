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
import { z } from 'zod';

import type { DecisionInstanceData } from './schemas/instanceData';

const readDataScript = (name: string) =>
  readFileSync(
    new URL(`../../../../../services/db/data/${name}`, import.meta.url),
    'utf8',
  );

const backfillSql = readDataScript('backfill-phase-rows.sql');
const driftSql = readDataScript('check-phase-drift.sql');
const stripSql = readDataScript('strip-blob-phases.sql');

const driftRowSchema = z.object({
  instance_id: z.string(),
  kind: z.enum(['no_rows', 'partial', 'drift']),
  blob_phases: z.number(),
  row_phases: z.number(),
  missing_rows: z.array(z.string().nullable()),
  extra_rows: z.array(z.string()),
});

const proposalTemplate = {
  type: 'object',
  properties: { title: { type: 'string' } },
};

const ASTRAL = String.fromCodePoint(0x1f600);
const NBSP = String.fromCharCode(0xa0);
const IDEOGRAPHIC_SPACE = String.fromCharCode(0x3000);

describe.concurrent('backfill-phase-rows data script', () => {
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
    const profileId = await insertPhaseRow(testData, instanceId, {});

    await runBackfill(testData, instanceId);

    expect(
      (await readPhaseRows(instanceId)).map((row) => row.profileId),
    ).toEqual([profileId]);
  });

  it('given fill_partial and rows that cover one of two phases, then the uncovered phase gets a row and a second run changes nothing', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const instanceId = await seedDecision(testData, {});
    const profileId = await insertPhaseRow(testData, instanceId, {
      phaseId: 'initial',
    });
    const fillPartial = { 'op_backfill.fill_partial': 'true' };

    await runBackfill(testData, instanceId, fillPartial);
    const rows = await readPhaseRows(instanceId);

    expect(rows.map((row) => row.data)).toEqual([
      { phaseId: 'initial' },
      expect.objectContaining({ phaseId: 'final' }),
    ]);
    expect(rows.map((row) => row.sortOrder)).toEqual([0, 1]);
    expect(rows[0]?.profileId).toBe(profileId);
    expect(rows[1]?.type).toBe(EntityType.PHASE);
    expect(rows[1]?.slug).toMatch(/^[0-9a-f]{8}$/);

    await runBackfill(testData, instanceId, fillPartial);

    expect(await readPhaseRows(instanceId)).toEqual(rows);
  });

  it('given a blank instance_ids, then the run fails before it changes anything', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const instanceId = await seedDecision(testData, {});

    await expect(
      runBackfill(testData, instanceId, { 'op_backfill.instance_ids': ' ' }),
    ).rejects.toThrow(/op_backfill\.instance_ids is required/);

    expect(await readPhaseRows(instanceId)).toEqual([]);
  });

  it('given fill_partial and instance_ids set to all, then the run fails before it changes anything', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const instanceId = await seedDecision(testData, {});

    await expect(
      runBackfill(testData, instanceId, {
        'op_backfill.instance_ids': 'all',
        'op_backfill.fill_partial': 'true',
      }),
    ).rejects.toThrow(/fill_partial needs a uuid list/);

    expect(await readPhaseRows(instanceId)).toEqual([]);
  });

  it('given a decision locked by another session, then the run stops there and the decision before it stays backfilled', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const first = await seedDecision(testData, {});
    const locked = await seedDecision(testData, {});

    let releaseLock = () => {};
    const lockReleased = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    let markLockTaken = () => {};
    const lockTaken = new Promise<void>((resolve) => {
      markLockTaken = resolve;
    });
    const holder = db.transaction(async (tx) => {
      await tx
        .select({ id: processInstances.id })
        .from(processInstances)
        .where(eq(processInstances.id, locked))
        .for('update');
      markLockTaken();
      await lockReleased;
    });
    await lockTaken;

    try {
      await expect(
        runBackfill(testData, [first, locked], { lock_timeout: '200ms' }),
      ).rejects.toThrow(/lock timeout/);
    } finally {
      releaseLock();
      await holder;
    }

    expect(await readPhaseRows(first)).toHaveLength(2);
    expect(await readPhaseRows(locked)).toEqual([]);
  });

  it('given instance_ids naming two of three decisions, then only those two get rows', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const first = await seedDecision(testData, {});
    const second = await seedDecision(testData, {});
    const unlisted = await seedDecision(testData, {});

    await runBackfill(testData, [first, second]);

    expect(await readPhaseRows(first)).toHaveLength(2);
    expect(await readPhaseRows(second)).toHaveLength(2);
    expect(await readPhaseRows(unlisted)).toEqual([]);
  });

  it('given decisions out of step with their blob, then the drift check names them, and returns nothing once they agree', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const shrunk = await seedDecision(testData, {});
    const grown = await seedDecision(testData, {});
    const ids = [shrunk, grown];

    expect(await runDriftCheck(ids)).toEqual(
      sortByInstance(
        ids.map((instanceId) => ({
          instance_id: instanceId,
          kind: 'no_rows',
          blob_phases: 2,
          row_phases: 0,
          missing_rows: ['final', 'initial'],
          extra_rows: [],
        })),
      ),
    );

    await runBackfill(testData, ids);
    expect(await runDriftCheck(ids)).toEqual([]);

    await db
      .update(processInstances)
      .set({
        instanceData: sql`jsonb_set(${processInstances.instanceData}, '{phases}', (${processInstances.instanceData} -> 'phases') - -1)`,
      })
      .where(eq(processInstances.id, shrunk));
    await db
      .update(processInstances)
      .set({
        instanceData: sql`jsonb_set(${processInstances.instanceData}, '{phases}', (${processInstances.instanceData} -> 'phases') || '[{"phaseId":"added","name":"Added"}]'::jsonb)`,
      })
      .where(eq(processInstances.id, grown));

    expect(await runDriftCheck(ids)).toEqual(
      sortByInstance([
        {
          instance_id: shrunk,
          kind: 'drift',
          blob_phases: 1,
          row_phases: 2,
          missing_rows: [],
          extra_rows: ['final'],
        },
        {
          instance_id: grown,
          kind: 'partial',
          blob_phases: 3,
          row_phases: 2,
          missing_rows: ['added'],
          extra_rows: [],
        },
      ]),
    );
    expect(
      await runDriftCheck(ids, { 'op_backfill.drift_kind': 'no_rows' }),
    ).toEqual([]);
  });

  it('given instance_ids set to all, then the drift check covers every decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const instanceId = await seedDecision(testData, {});

    const rows = await runDriftCheck([], {
      'op_backfill.instance_ids': 'all',
      'op_backfill.drift_kind': 'no_rows',
    });

    expect(rows.map((row) => row.instance_id)).toContain(instanceId);
  });

  it('given a blank instance_ids, then the drift check and the strip fail, and the strip changes nothing', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const instanceId = await seedDecision(testData, {});
    await runBackfill(testData, instanceId);
    const before = await readInstanceData(instanceId);

    await expect(
      runDriftCheck([], { 'op_backfill.instance_ids': ' ' }),
    ).rejects.toThrow(/op_backfill\.instance_ids is required/);
    await expect(
      runStrip([], { 'op_backfill.instance_ids': ' ' }),
    ).rejects.toThrow(/op_backfill\.instance_ids is required/);

    expect(before).toHaveProperty('phases');
    expect(await readInstanceData(instanceId)).toEqual(before);
  });

  it('given one decision with phase rows and one without, then the strip removes the blob phases from the first only', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const withRows = await seedDecision(testData, {});
    const withoutRows = await seedDecision(testData, {});
    await runBackfill(testData, withRows);
    const withoutRowsBefore = await readInstanceData(withoutRows);

    await runStrip([withRows, withoutRows]);

    expect(await readInstanceData(withRows)).not.toHaveProperty('phases');
    expect(await readInstanceData(withoutRows)).toEqual(withoutRowsBefore);
    expect(withoutRowsBefore).toHaveProperty('phases');
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

type Settings = Record<string, string>;

// Every script reads instance_ids, so a run touches only this test's decisions.
const scopedSettings = (instanceIds: string[], settings: Settings) =>
  Object.entries({
    'op_backfill.instance_ids': instanceIds.join(', '),
    ...settings,
  });

const runInScope = async (
  script: string,
  instanceIds: string[],
  settings: Settings = {},
) =>
  db.transaction(async (tx) => {
    for (const [name, value] of scopedSettings(instanceIds, settings)) {
      await tx.execute(sql`select set_config(${name}, ${value}, true)`);
    }
    return tx.execute(sql.raw(script));
  });

// The backfill commits per decision, so it needs its own session outside a transaction.
const runBackfill = async (
  testData: TestDecisionsDataManager,
  instanceIds: string | string[],
  settings: Settings = {},
) => {
  const ids = [instanceIds].flat();
  const connection = await db.$client.reserve();
  try {
    for (const [name, value] of scopedSettings(ids, settings)) {
      await connection`select set_config(${name}, ${value}, false)`;
    }
    await connection.unsafe(backfillSql);
  } finally {
    await connection`reset all`;
    connection.release();
    for (const instanceId of ids) {
      const rows = await readPhaseRows(instanceId);
      rows.forEach((row) => testData.trackProfileForCleanup(row.profileId));
    }
  }
};

// postgres.js resolves a multi-statement script to one result set per statement
const lastResultSet = (result: unknown): unknown[] => {
  const sets = z.array(z.array(z.unknown())).safeParse(result);
  return sets.success
    ? (sets.data.at(-1) ?? [])
    : z.array(z.unknown()).parse(result);
};

const runDriftCheck = async (instanceIds: string[], settings?: Settings) => {
  const result = await runInScope(driftSql, instanceIds, settings);
  return z.array(driftRowSchema).parse(lastResultSet(result));
};

const runStrip = (instanceIds: string[], settings?: Settings) =>
  runInScope(stripSql, instanceIds, settings);

const insertPhaseRow = async (
  testData: TestDecisionsDataManager,
  processInstanceId: string,
  data: Record<string, unknown>,
) => {
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
    .values({ processInstanceId, sortOrder: 0, profileId: profile.id, data });
  return profile.id;
};

const sortByInstance = <T extends { instance_id: string }>(rows: T[]) =>
  [...rows].sort((a, b) => (a.instance_id < b.instance_id ? -1 : 1));

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
