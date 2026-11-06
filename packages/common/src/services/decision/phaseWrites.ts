import { type TransactionType, db, eq } from '@op/db/client';
import { ProcessStatus, processPhases } from '@op/db/schema';

import { invalidateDecisionInstance } from './decisionCache';
import {
  type LockedProcessInstance,
  lockProcessInstanceOrThrow,
} from './lockProcessInstance';
import {
  type ProcessPhaseWithProfile,
  assertPhaseRowInvariants,
  listPhases,
  phaseIdOf,
  reconcilePhases,
} from './phaseHelpers';
import { getInstancePhases } from './schemas/instanceData';
import { updateTransitionsForProcess } from './updateTransitionsForProcess';

type StoredPhases = Pick<LockedProcessInstance, 'status' | 'currentStateId'> & {
  phases: ProcessPhaseWithProfile[];
};

/**
 * Runs a phase endpoint's row write in a transaction under the instance lock,
 * then clears its cache. See {@link writePhasesInTx}.
 */
export const writePhases = async <T>({
  processInstanceId,
  write,
}: {
  processInstanceId: string;
  write: (tx: TransactionType, stored: StoredPhases) => Promise<T>;
}): Promise<{ result: T; phases: ProcessPhaseWithProfile[] }> => {
  const written = await db.transaction(async (tx) => {
    const locked = await lockProcessInstanceOrThrow({
      db: tx,
      instanceId: processInstanceId,
    });

    return writePhasesInTx({ tx, processInstanceId, locked, write });
  });

  await invalidateDecisionInstance(processInstanceId);

  return written;
};

/**
 * Runs a row write for an instance the caller has locked, checks and
 * renumbers the rows it leaves, and reschedules the transitions of a decision
 * past draft.
 */
export const writePhasesInTx = async <T>({
  tx,
  processInstanceId,
  locked,
  write,
  syncTransitions = true,
}: {
  tx: TransactionType;
  processInstanceId: string;
  locked: LockedProcessInstance;
  write: (tx: TransactionType, stored: StoredPhases) => Promise<T>;
  // False when the caller syncs transitions itself after the write.
  syncTransitions?: boolean;
}): Promise<{ result: T; phases: ProcessPhaseWithProfile[] }> => {
  const before = await listPhasesForWrite({
    tx,
    processInstanceId,
    instanceData: locked.instanceData,
  });

  const result = await write(tx, {
    phases: before,
    status: locked.status,
    currentStateId: locked.currentStateId,
  });

  const listed = await listPhases({ db: tx, processInstanceId });
  assertPhaseRowInvariants({
    rows: listed,
    previousPhaseIds: before.map(phaseIdOf),
    instance: locked,
  });
  const phases = await renumberPhases({
    tx,
    rows: listed,
    previousRowIds: new Set(before.map(({ id }) => id)),
  });

  if (syncTransitions && locked.status !== ProcessStatus.DRAFT) {
    await updateTransitionsForProcess({
      processInstance: {
        id: processInstanceId,
        instanceData: locked.instanceData,
      },
      phases,
      db: tx,
    });
  }

  return { result, phases };
};

// A row added at a taken sortOrder goes before the one already there.
const renumberPhases = async ({
  tx,
  rows,
  previousRowIds,
}: {
  tx: TransactionType;
  rows: ProcessPhaseWithProfile[];
  previousRowIds: ReadonlySet<string>;
}): Promise<ProcessPhaseWithProfile[]> => {
  const isPrevious = (row: ProcessPhaseWithProfile) =>
    Number(previousRowIds.has(row.id));
  const ordered = [...rows].sort(
    (a, b) => a.sortOrder - b.sortOrder || isPrevious(a) - isPrevious(b),
  );

  for (const [sortOrder, row] of ordered.entries()) {
    if (row.sortOrder !== sortOrder) {
      await tx
        .update(processPhases)
        .set({ sortOrder })
        .where(eq(processPhases.id, row.id));
    }
  }

  return ordered.map((row, sortOrder) => ({ ...row, sortOrder }));
};

// TODO: drop the blob conversion when instanceData.phases is dropped.
const listPhasesForWrite = async ({
  tx,
  processInstanceId,
  instanceData,
}: {
  tx: TransactionType;
  processInstanceId: string;
  instanceData: unknown;
}): Promise<ProcessPhaseWithProfile[]> => {
  const phases = await listPhases({ db: tx, processInstanceId });
  const blobPhases = getInstancePhases(instanceData);
  if (phases.length > 0 || blobPhases.length === 0) {
    return phases;
  }

  return reconcilePhases({
    tx,
    processInstanceId,
    existing: [],
    phases: blobPhases,
  });
};
