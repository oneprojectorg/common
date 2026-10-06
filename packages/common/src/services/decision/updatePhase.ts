import { db, eq } from '@op/db/client';
import {
  type ProcessPhase,
  type Profile,
  processPhases,
  profiles,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError, ValidationError } from '../../utils';
import {
  type PhaseData,
  getPhaseAsDecisionAdmin,
  phaseDataSchema,
} from './phaseHelpers';

/**
 * Updates whichever of a phase's name and data are given, in one transaction.
 *
 * - `name` is written to the phase's profile. The slug is left alone, so links
 *   keep working once phases are routable — the same trade `updateProposal`
 *   makes.
 * - `data` replaces the whole blob and is validated against `phaseDataSchema`,
 *   so a write can never drop `phaseId`.
 *
 * Needs decisions ADMIN on the instance's profile, like `createPhase`.
 */
export const updatePhase = async ({
  user,
  phaseId,
  name,
  data,
}: {
  user: User;
  phaseId: string;
  name?: string;
  data?: PhaseData;
}): Promise<{ phase: ProcessPhase; profile: Profile }> => {
  if (name === undefined && data === undefined) {
    throw new ValidationError('Nothing to update');
  }
  const phaseData =
    data === undefined ? undefined : phaseDataSchema.parse(data);

  const { profileId } = await getPhaseAsDecisionAdmin({ user, phaseId });

  return db.transaction(async (tx) => {
    const [profile] =
      name === undefined
        ? await tx.select().from(profiles).where(eq(profiles.id, profileId))
        : await tx
            .update(profiles)
            .set({ name })
            .where(eq(profiles.id, profileId))
            .returning();

    const [phase] =
      phaseData === undefined
        ? await tx
            .select()
            .from(processPhases)
            .where(eq(processPhases.id, phaseId))
        : await tx
            .update(processPhases)
            .set({ data: phaseData })
            .where(eq(processPhases.id, phaseId))
            .returning();

    // Deleted between the access check and the write.
    if (!profile || !phase) {
      throw new NotFoundError('Phase', phaseId);
    }

    return { phase, profile };
  });
};
