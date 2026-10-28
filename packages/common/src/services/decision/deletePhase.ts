import { db, eq } from '@op/db/client';
import { profiles } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError } from '../../utils';
import { lockProcessInstanceOrThrow } from './lockProcessInstance';
import { getPhaseAsDecisionAdmin } from './phaseHelpers';
import {
  loadPhaseRows,
  phaseIdOf,
  writePhaseRowsToInstanceData,
} from './phaseRows';

export const deletePhase = async ({
  user,
  phaseId,
}: {
  user: User;
  phaseId: string;
}): Promise<void> => {
  const phase = await getPhaseAsDecisionAdmin({ user, phaseId });

  await db.transaction(async (tx) => {
    const locked = await lockProcessInstanceOrThrow({
      db: tx,
      instanceId: phase.processInstanceId,
    });

    const row = (
      await loadPhaseRows({
        db: tx,
        processInstanceId: phase.processInstanceId,
      })
    ).find(({ id }) => id === phaseId);
    if (!row) {
      throw new NotFoundError('Phase', phaseId);
    }

    // The profile cascades to the phase row, not the other way round.
    await tx.delete(profiles).where(eq(profiles.id, row.profileId));

    await writePhaseRowsToInstanceData({
      db: tx,
      processInstanceId: phase.processInstanceId,
      instanceData: locked.instanceData,
      removedPhaseId: phaseIdOf(row),
    });
  });
};
