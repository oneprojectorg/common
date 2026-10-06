import { db, eq } from '@op/db/client';
import { type Profile, profiles } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError } from '../../utils';
import { getPhaseAsDecisionAdmin } from './phaseHelpers';

/**
 * Renames a phase by writing its profile, leaving the slug alone so links keep
 * working once phases are routable — the same trade `updateProposal` makes.
 * Needs decisions ADMIN on the instance's profile, like `createPhase`.
 */
export const renamePhase = async ({
  user,
  phaseId,
  name,
}: {
  user: User;
  phaseId: string;
  name: string;
}): Promise<Profile> => {
  const phase = await getPhaseAsDecisionAdmin({ user, phaseId });

  const [profile] = await db
    .update(profiles)
    .set({ name })
    .where(eq(profiles.id, phase.profileId))
    .returning();

  // Deleted between the access check and the write.
  if (!profile) {
    throw new NotFoundError('Phase', phaseId);
  }

  return profile;
};
