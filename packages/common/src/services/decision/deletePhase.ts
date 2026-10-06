import { db, eq } from '@op/db/client';
import { profiles } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError } from '../../utils';
import { getPhaseAsDecisionAdmin } from './phaseHelpers';

export const deletePhase = async ({
  user,
  phaseId,
}: {
  user: User;
  phaseId: string;
}): Promise<void> => {
  const phase = await getPhaseAsDecisionAdmin({ user, phaseId });

  // The profile cascades to the phase row, not the other way round.
  const [deleted] = await db
    .delete(profiles)
    .where(eq(profiles.id, phase.profileId))
    .returning({ id: profiles.id });

  if (!deleted) {
    throw new NotFoundError('Phase', phaseId);
  }
};
