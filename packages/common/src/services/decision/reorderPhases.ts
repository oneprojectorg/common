import { asc, db, eq, sql } from '@op/db/client';
import { processPhases, profiles } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError, ValidationError } from '../../utils';
import { lockProcessInstanceOrThrow } from './lockProcessInstance';
import { assertDecisionAdmin } from './phaseHelpers';

export interface PhasePlacement {
  phaseId: string;
  startDate?: string;
  endDate?: string;
}

export interface ReorderedPhase {
  id: string;
  profileId: string;
  name: string;
  slug: string;
  sortOrder: number;
  data: unknown;
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
}): Promise<ReorderedPhase[]> => {
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

  return db.transaction(async (tx) => {
    await lockProcessInstanceOrThrow({ db: tx, instanceId: processInstanceId });

    const stored = await tx
      .select({ id: processPhases.id })
      .from(processPhases)
      .where(eq(processPhases.processInstanceId, processInstanceId));

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

    return tx
      .select({
        id: processPhases.id,
        profileId: processPhases.profileId,
        name: profiles.name,
        slug: profiles.slug,
        sortOrder: processPhases.sortOrder,
        data: processPhases.data,
      })
      .from(processPhases)
      .innerJoin(profiles, eq(profiles.id, processPhases.profileId))
      .where(eq(processPhases.processInstanceId, processInstanceId))
      .orderBy(asc(processPhases.sortOrder), asc(processPhases.id));
  });
};
