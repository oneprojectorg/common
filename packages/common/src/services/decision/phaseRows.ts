import { type DbClient, asc, eq, inArray, sql } from '@op/db/client';
import { processInstances, processPhases, profiles } from '@op/db/schema';

import {
  type PhaseRowData,
  assertPhasesCanBeMinted,
  getPhaseProfileName,
  insertPhase,
} from './phaseHelpers';
import type {
  DecisionInstanceData,
  PhaseInstanceData,
} from './schemas/instanceData';

interface PhaseRow {
  id: string;
  profileId: string;
  sortOrder: number;
  data: PhaseRowData;
  name: string;
  slug: string;
}

/** The decision's rows in order, each with the name its profile holds. */
export const loadPhaseRows = async ({
  db,
  processInstanceId,
}: {
  db: DbClient;
  processInstanceId: string;
}): Promise<PhaseRow[]> => {
  const rows = await db
    .select({
      id: processPhases.id,
      profileId: processPhases.profileId,
      sortOrder: processPhases.sortOrder,
      data: processPhases.data,
      name: profiles.name,
      slug: profiles.slug,
    })
    .from(processPhases)
    .innerJoin(profiles, eq(profiles.id, processPhases.profileId))
    .where(eq(processPhases.processInstanceId, processInstanceId))
    .orderBy(asc(processPhases.sortOrder));

  return rows.map((row) => ({ ...row, data: readPhaseRowData(row.data) }));
};

/** {@link loadPhaseRows} for several decisions in one query, keyed by instance. */
export const loadPhaseRowsByInstance = async ({
  db,
  processInstanceIds,
}: {
  db: DbClient;
  processInstanceIds: string[];
}): Promise<Map<string, PhaseRow[]>> => {
  const rowsByInstance = new Map<string, PhaseRow[]>();

  if (processInstanceIds.length === 0) {
    return rowsByInstance;
  }

  const rows = await db
    .select({
      processInstanceId: processPhases.processInstanceId,
      id: processPhases.id,
      profileId: processPhases.profileId,
      sortOrder: processPhases.sortOrder,
      data: processPhases.data,
      name: profiles.name,
      slug: profiles.slug,
    })
    .from(processPhases)
    .innerJoin(profiles, eq(profiles.id, processPhases.profileId))
    .where(inArray(processPhases.processInstanceId, processInstanceIds))
    .orderBy(
      asc(processPhases.processInstanceId),
      asc(processPhases.sortOrder),
    );

  for (const { processInstanceId, ...row } of rows) {
    const instanceRows = rowsByInstance.get(processInstanceId) ?? [];
    instanceRows.push({ ...row, data: readPhaseRowData(row.data) });
    rowsByInstance.set(processInstanceId, instanceRows);
  }

  return rowsByInstance;
};

/** The rows in the shape `instance_data` keeps, for the readers still on it. */
export const projectPhaseRows = (rows: PhaseRow[]): PhaseInstanceData[] =>
  rows.map(projectPhaseRow);

export const getInstanceDataPhases = (
  instanceData: unknown,
): PhaseInstanceData[] =>
  (instanceData as DecisionInstanceData | null)?.phases ?? [];

/**
 * The phases a decision holds: its rows, plus each `instance_data` phase that
 * has no row yet (the phase endpoints can write rows before the backfill).
 */
export const getStoredPhases = ({
  rows,
  blobPhases,
}: {
  rows: PhaseRow[];
  blobPhases: PhaseInstanceData[];
}): PhaseInstanceData[] => {
  const rowPhaseIds = new Set(rows.map(phaseIdOf));
  // A blob phase has no sortOrder; its index stands in, and a row wins a tie.
  const placed = [
    ...rows.map((row) => ({
      position: row.sortOrder,
      rank: 0,
      phase: projectPhaseRow(row),
    })),
    ...blobPhases.flatMap((phase, position) =>
      rowPhaseIds.has(phase.phaseId) ? [] : [{ position, rank: 1, phase }],
    ),
  ];

  return placed
    .sort((a, b) => a.position - b.position || a.rank - b.rank)
    .map(({ phase }) => phase);
};

/**
 * Mirrors the rows onto `instance_data.phases` after a phase endpoint writes,
 * so the builder's next save lists them. The caller holds the instance lock.
 */
export const writePhaseRowsToInstanceData = async ({
  db,
  processInstanceId,
  instanceData,
  removedPhaseId,
}: {
  db: DbClient;
  processInstanceId: string;
  /** Read under the lock. */
  instanceData: unknown;
  removedPhaseId?: string;
}): Promise<void> => {
  const phases = getStoredPhases({
    rows: await loadPhaseRows({ db, processInstanceId }),
    blobPhases: getInstanceDataPhases(instanceData).filter(
      ({ phaseId }) => phaseId !== removedPhaseId,
    ),
  });

  await db
    .update(processInstances)
    .set({
      instanceData: sql`jsonb_set(${processInstances.instanceData}, '{phases}', ${JSON.stringify(phases)}::jsonb)`,
    })
    .where(eq(processInstances.id, processInstanceId));
};

export const insertPhaseRows = async ({
  db,
  processInstanceId,
  phases,
}: {
  db: DbClient;
  processInstanceId: string;
  phases: PhaseInstanceData[];
}): Promise<void> => {
  assertPhasesCanBeMinted(phases);

  for (const [sortOrder, phase] of phases.entries()) {
    const { name: _name, ...data } = phase;
    await insertPhase({
      tx: db,
      processInstanceId,
      name: getPhaseProfileName(phase),
      sortOrder,
      data,
    });
  }
};

/**
 * Makes `rows`, loaded under the instance lock, match `phases` in that order,
 * and returns the result. A phase the list leaves out is deleted with its
 * profile.
 */
export const reconcilePhaseRows = async ({
  db,
  processInstanceId,
  rows,
  phases,
}: {
  db: DbClient;
  processInstanceId: string;
  rows: PhaseRow[];
  phases: PhaseInstanceData[];
}): Promise<PhaseRow[]> => {
  assertPhasesCanBeMinted(phases);

  const rowByPhaseId = new Map(rows.map((row) => [phaseIdOf(row), row]));
  const reconciled: PhaseRow[] = [];

  for (const [sortOrder, phase] of phases.entries()) {
    const row = rowByPhaseId.get(phase.phaseId);
    const { name: _name, ...data } = phase;
    const name = getPhaseProfileName(phase);

    if (!row) {
      const inserted = await insertPhase({
        tx: db,
        processInstanceId,
        name,
        sortOrder,
        data,
      });
      reconciled.push({
        id: inserted.phase.id,
        profileId: inserted.profile.id,
        sortOrder,
        data,
        name: inserted.profile.name,
        slug: inserted.profile.slug,
      });
      continue;
    }

    await db
      .update(processPhases)
      .set({ sortOrder, data })
      .where(eq(processPhases.id, row.id));

    if (row.name !== name) {
      await db
        .update(profiles)
        .set({ name })
        .where(eq(profiles.id, row.profileId));
    }

    reconciled.push({ ...row, sortOrder, data, name });
  }

  const kept = new Set(reconciled.map(({ id }) => id));
  const removed = rows
    .filter((row) => !kept.has(row.id))
    .map((row) => row.profileId);
  if (removed.length > 0) {
    await db.delete(profiles).where(inArray(profiles.id, removed));
  }

  return reconciled;
};

// A row minted from `instance_data` carries that phase's id; one made by the
// phase endpoints has only its slug, which is just as stable.
export const phaseIdOf = (row: PhaseRow): string =>
  row.data.phaseId ?? row.slug;

const projectPhaseRow = (row: PhaseRow): PhaseInstanceData => ({
  ...row.data,
  phaseId: phaseIdOf(row),
  name: row.name,
});

const readPhaseRowData = (data: unknown): PhaseRowData =>
  typeof data === 'object' && data !== null && !Array.isArray(data)
    ? (data as PhaseRowData)
    : {};
