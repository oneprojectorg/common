import { type DbClient, asc, eq, inArray, sql } from '@op/db/client';
import { processInstances, processPhases, profiles } from '@op/db/schema';
import { isDeepStrictEqual } from 'node:util';

import { lockProcessInstanceOrThrow } from './lockProcessInstance';
import {
  type PhaseRowData,
  assertPhasesCanBeMinted,
  getPhaseProfileName,
  insertPhase,
  isJsonObject,
} from './phaseHelpers';
import {
  type PhaseInstanceData,
  getInstancePhases,
} from './schemas/instanceData';

export interface PhaseRow {
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
    .orderBy(asc(processPhases.sortOrder), asc(processPhases.id));

  return rows.map((row) => ({ ...row, data: readPhaseRowData(row.data) }));
};

/**
 * The phases a decision holds: its rows, plus each `instance_data` phase that
 * has no row yet (the phase endpoints can write rows before the backfill).
 */
export const getStoredPhases = ({
  rows,
  blobPhases,
}: {
  rows: PhaseRow[];
  blobPhases: readonly PhaseInstanceData[];
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
 * Locks the decision, hands its phase rows to `mutate`, then mirrors the rows
 * onto `instance_data.phases` so the builder's next save lists them. The blob
 * phases without a row are noted before the write, so a deleted row does not
 * come back through the blob.
 */
export const mutatePhaseRows = async <T>({
  db,
  processInstanceId,
  mutate,
}: {
  db: DbClient;
  processInstanceId: string;
  mutate: (stored: {
    rows: PhaseRow[];
    rowlessPhases: PhaseInstanceData[];
  }) => Promise<T>;
}): Promise<{ result: T; rows: PhaseRow[] }> => {
  const locked = await lockProcessInstanceOrThrow({
    db,
    instanceId: processInstanceId,
  });
  const rows = await loadPhaseRows({ db, processInstanceId });
  const rowPhaseIds = new Set(rows.map(phaseIdOf));
  const rowlessPhases = getInstancePhases(locked.instanceData).filter(
    ({ phaseId }) => !rowPhaseIds.has(phaseId),
  );

  const result = await mutate({ rows, rowlessPhases });

  const written = await loadPhaseRows({ db, processInstanceId });
  const phases = getStoredPhases({ rows: written, blobPhases: rowlessPhases });
  await db
    .update(processInstances)
    .set({
      instanceData: sql`jsonb_set(${processInstances.instanceData}, '{phases}', ${JSON.stringify(phases)}::jsonb)`,
    })
    .where(eq(processInstances.id, processInstanceId));

  return { result, rows: written };
};

/**
 * Makes `rows`, loaded under the instance lock, match `phases` in that order.
 * A phase the list leaves out is deleted with its profile; a row the list
 * leaves as it is stays untouched.
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
}): Promise<void> => {
  assertPhasesCanBeMinted(phases);

  const rowByPhaseId = new Map(rows.map((row) => [phaseIdOf(row), row]));

  for (const [sortOrder, phase] of phases.entries()) {
    const row = rowByPhaseId.get(phase.phaseId);
    const { name: _name, ...data } = phase;
    const name = getPhaseProfileName(phase);

    if (!row) {
      await insertPhase({ tx: db, processInstanceId, name, sortOrder, data });
      continue;
    }

    if (row.sortOrder !== sortOrder || !isDeepStrictEqual(row.data, data)) {
      await db
        .update(processPhases)
        .set({ sortOrder, data })
        .where(eq(processPhases.id, row.id));
    }

    if (row.name !== name) {
      await db
        .update(profiles)
        .set({ name })
        .where(eq(profiles.id, row.profileId));
    }
  }

  const listed = new Set(phases.map(({ phaseId }) => phaseId));
  const removed = rows
    .filter((row) => !listed.has(phaseIdOf(row)))
    .map((row) => row.profileId);
  if (removed.length > 0) {
    await db.delete(profiles).where(inArray(profiles.id, removed));
  }
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

// Shape only; the fields are checked where they are used.
const isPhaseRowData = (value: unknown): value is PhaseRowData =>
  isJsonObject(value);

const readPhaseRowData = (data: unknown): PhaseRowData =>
  isPhaseRowData(data) ? data : {};
