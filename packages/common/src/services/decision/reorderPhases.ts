import { db, eq, sql } from '@op/db/client';
import { processPhases } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError, ValidationError } from '../../utils';
import {
  type ProcessPhaseWithProfile,
  assertDecisionAdmin,
} from './phaseHelpers';
import { writePhases } from './phaseWrites';

export interface PhasePlacement {
  phaseId: string;
  startDate?: string;
  endDate?: string;
}

// TODO: refuse moving phases that have already run, once currentStateId
// points at a phase row.
export const reorderPhases = async ({
  user,
  processInstanceId,
  phases,
}: {
  user: User;
  processInstanceId: string;
  phases: PhasePlacement[];
}): Promise<ProcessPhaseWithProfile[]> => {
  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: { profileId: true },
  });

  if (!instance) {
    throw new NotFoundError('Decision', processInstanceId);
  }

  await assertDecisionAdmin({ user, decisionProfileId: instance.profileId });

  const requestedIds = new Set(phases.map((phase) => phase.phaseId));
  if (requestedIds.size !== phases.length) {
    throw new ValidationError('A phase is listed more than once', {
      phases: 'List each phase once',
    });
  }

  const { phases: reordered } = await writePhases({
    processInstanceId,
    write: async (tx, { phases: stored }) => {
      if (
        stored.length !== requestedIds.size ||
        !stored.every((phase) => requestedIds.has(phase.id))
      ) {
        throw new ValidationError("The phases don't match the decision's", {
          phases: 'List every phase of this decision, and only those',
        });
      }

      for (const [
        sortOrder,
        { phaseId, startDate, endDate },
      ] of phases.entries()) {
        const dates = {
          ...(startDate !== undefined && { startDate }),
          ...(endDate !== undefined && { endDate }),
        };
        await tx
          .update(processPhases)
          .set({
            sortOrder,
            data: sql`${processPhases.data} || ${JSON.stringify(dates)}::jsonb`,
          })
          .where(eq(processPhases.id, phaseId));
      }
    },
  });

  return reordered;
};
