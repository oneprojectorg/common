import { db, eq } from '@op/db/client';
import { profiles } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError } from '../../utils';
import { getPhaseAsDecisionAdmin } from './phaseHelpers';
import { mutatePhases } from './phaseMirror';

export const deletePhase = async ({
  user,
  phaseId,
}: {
  user: User;
  phaseId: string;
}): Promise<void> => {
  const phase = await getPhaseAsDecisionAdmin({ user, phaseId });

  await db.transaction((tx) =>
    mutatePhases({
      db: tx,
      processInstanceId: phase.processInstanceId,
      mutate: async ({ phases }) => {
        const phase = phases.find(({ id }) => id === phaseId);
        if (!phase) {
          throw new NotFoundError('Phase', phaseId);
        }

        await tx.delete(profiles).where(eq(profiles.id, phase.profileId));
      },
    }),
  );
};
