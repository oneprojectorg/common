import { type TransactionType, db, eq } from '@op/db/client';
import { ProcessStatus, processPhases } from '@op/db/schema';

import { invalidateDecisionInstance } from './decisionCache';
import {
  type LockedProcessInstance,
  lockProcessInstanceOrThrow,
} from './lockProcessInstance';
import {
  type ProcessPhaseWithProfile,
  assertPastPhasesUnchanged,
  assertPhaseRowInvariants,
  listPhases,
  phaseIdOf,
  toInstanceDataPhase,
} from './phaseHelpers';
import { updateTransitionsForProcess } from './updateTransitionsForProcess';

/**
 * Runs a phase endpoint's row write in a transaction under the instance lock,
 * reschedules the transitions of a decision past draft, then clears its cache.
 * See {@link writePhasesInTx}.
 */
export const writePhasesWithLock = async <T>({
  processInstanceId,
  write,
}: {
  processInstanceId: string;
  write: (tx: TransactionType, before: ProcessPhaseWithProfile[]) => Promise<T>;
}): Promise<{ result: T; phases: ProcessPhaseWithProfile[] }> => {
  const written = await db.transaction(async (tx) => {
    const locked = await lockProcessInstanceOrThrow({
      db: tx,
      instanceId: processInstanceId,
    });

    const written = await writePhasesInTx({
      tx,
      processInstanceId,
      locked,
      write,
    });

    if (locked.status !== ProcessStatus.DRAFT) {
      await updateTransitionsForProcess({
        processInstance: {
          id: processInstanceId,
          instanceData: locked.instanceData,
          currentStateId: locked.currentStateId,
        },
        phases: written.phases,
        db: tx,
      });
    }

    return written;
  });

  await invalidateDecisionInstance(processInstanceId);

  return written;
};

/**
 * Runs a row write for an instance the caller has locked, then checks and
 * renumbers the rows it leaves. The caller syncs transitions.
 */
export const writePhasesInTx = async <T>({
  tx,
  processInstanceId,
  locked,
  write,
  nextStatus = locked.status,
}: {
  tx: TransactionType;
  processInstanceId: string;
  locked: LockedProcessInstance;
  write: (tx: TransactionType, before: ProcessPhaseWithProfile[]) => Promise<T>;
  // The status this save leaves, when it also changes the status.
  nextStatus?: LockedProcessInstance['status'];
}): Promise<{ result: T; phases: ProcessPhaseWithProfile[] }> => {
  const before = await listPhases({ db: tx, processInstanceId });

  const result = await write(tx, before);

  const listed = await listPhases({ db: tx, processInstanceId });
  assertPhaseRowInvariants({
    rows: listed,
    previousPhaseIds: before.map(phaseIdOf),
    instance: { ...locked, status: nextStatus },
  });
  const phases = await renumberPhases({
    tx,
    rows: listed,
    previousRowIds: new Set(before.map(({ id }) => id)),
  });

  if (locked.status !== ProcessStatus.DRAFT) {
    assertPastPhasesUnchanged({
      before: before.map(toInstanceDataPhase),
      after: phases.map(toInstanceDataPhase),
      currentStateId: locked.currentStateId,
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
