import { db, eq } from '@op/db/client';
import { profiles } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError } from '../../utils';
import { lockProcessInstanceOrThrow } from './lockProcessInstance';
import { getPhaseAsDecisionAdmin } from './phaseHelpers';

export const deletePhase = async ({
  user,
  phaseId,
}: {
  user: User;
  phaseId: string;
}): Promise<void> => {
  const phase = await getPhaseAsDecisionAdmin({ user, phaseId });

  const [deleted] = await db.transaction(async (tx) => {
    await lockProcessInstanceOrThrow({
      db: tx,
      instanceId: phase.processInstanceId,
    });

    // The profile cascades to the phase row, not the other way round.
    return tx
      .delete(profiles)
      .where(eq(profiles.id, phase.profileId))
      .returning({ id: profiles.id });
  });

  if (!deleted) {
    throw new NotFoundError('Phase', phaseId);
  }
};
