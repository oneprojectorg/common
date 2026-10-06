import { db, eq } from '@op/db/client';
import { profiles } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError } from '../../utils';
import { getPhaseAsDecisionAdmin } from './phaseHelpers';

/**
 * Deletes a phase by deleting its *profile* and letting the `ON DELETE
 * CASCADE` on `profile_id` take the phase row with it, the way
 * `deleteDecision` does. Deleting the phase row directly would leave the
 * profile — and anything hung off it — behind. Needs decisions ADMIN on the
 * instance's profile, like `createPhase`.
 */
export const deletePhase = async ({
  user,
  phaseId,
}: {
  user: User;
  phaseId: string;
}): Promise<void> => {
  const phase = await getPhaseAsDecisionAdmin({ user, phaseId });

  const [deleted] = await db
    .delete(profiles)
    .where(eq(profiles.id, phase.profileId))
    .returning({ id: profiles.id });

  // Deleted between the access check and the write.
  if (!deleted) {
    throw new NotFoundError('Phase', phaseId);
  }
};
