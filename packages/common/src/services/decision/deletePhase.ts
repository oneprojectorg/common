import { eq } from '@op/db/client';
import { profiles } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError } from '../../utils';
import { getPhaseAsDecisionAdmin } from './phaseHelpers';
import { writePhases } from './phaseWrites';

export const deletePhase = async ({
  user,
  phaseId,
}: {
  user: User;
  phaseId: string;
}): Promise<void> => {
  const phase = await getPhaseAsDecisionAdmin({ user, phaseId });

  await writePhases({
    processInstanceId: phase.processInstanceId,
    write: async (tx) => {
      // The profile cascades to the phase row, not the other way round.
      const [deleted] = await tx
        .delete(profiles)
        .where(eq(profiles.id, phase.profileId))
        .returning({ id: profiles.id });

      if (!deleted) {
        throw new NotFoundError('Phase', phaseId);
      }
    },
  });
};
