import { type DbClient, asc, eq, inArray } from '@op/db/client';
import { processPhases, profiles } from '@op/db/schema';

import {
  type PhaseRowData,
  assertPhaseListFits,
  assertPhaseNameFits,
  getPhaseProfileName,
  insertPhase,
} from './phaseHelpers';
import type { PhaseInstanceData } from './schemas/instanceData';

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

/** The rows in the shape `instance_data` keeps, for the readers still on it. */
export const projectPhaseRows = (rows: PhaseRow[]): PhaseInstanceData[] =>
  rows.map((row) => ({
    ...row.data,
    phaseId: phaseIdOf(row),
    name: row.name,
  }));

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
  const projected = projectPhaseRows(rows);
  const rowPhaseIds = new Set(projected.map(({ phaseId }) => phaseId));

  return [
    ...projected,
    ...blobPhases.filter(({ phaseId }) => !rowPhaseIds.has(phaseId)),
  ];
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
  assertPhaseListFits(phases);

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
 * Makes the rows match `phases`, in that order. A phase the list leaves out
 * is deleted with its profile.
 */
export const reconcilePhaseRows = async ({
  db,
  processInstanceId,
  phases,
}: {
  db: DbClient;
  processInstanceId: string;
  phases: PhaseInstanceData[];
}): Promise<void> => {
  assertPhaseListFits(phases);

  const rows = await loadPhaseRows({ db, processInstanceId });
  const rowByPhaseId = new Map(rows.map((row) => [phaseIdOf(row), row]));
  const kept = new Set<string>();

  for (const [sortOrder, phase] of phases.entries()) {
    const row = rowByPhaseId.get(phase.phaseId);
    const { name: _name, ...data } = phase;
    const name = getPhaseProfileName(phase);

    if (!row) {
      await insertPhase({ tx: db, processInstanceId, name, sortOrder, data });
      continue;
    }

    kept.add(row.id);
    await db
      .update(processPhases)
      .set({ sortOrder, data })
      .where(eq(processPhases.id, row.id));

    if (row.name !== name) {
      assertPhaseNameFits(name);
      await db
        .update(profiles)
        .set({ name })
        .where(eq(profiles.id, row.profileId));
    }
  }

  const removed = rows
    .filter((row) => !kept.has(row.id))
    .map((row) => row.profileId);
  if (removed.length > 0) {
    await db.delete(profiles).where(inArray(profiles.id, removed));
  }
};

// A row minted from `instance_data` carries that phase's id; one made by the
// phase endpoints has only its slug, which is just as stable.
const phaseIdOf = (row: PhaseRow): string => row.data.phaseId ?? row.slug;

const readPhaseRowData = (data: unknown): PhaseRowData =>
  typeof data === 'object' && data !== null && !Array.isArray(data)
    ? (data as PhaseRowData)
    : {};
