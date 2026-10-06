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

    if (!profile || !phase) {
      throw new NotFoundError('Phase', phaseId);
    }

    return { phase, profile };
  });
};
