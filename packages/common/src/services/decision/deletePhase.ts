import { db, eq } from '@op/db/client';
import { profiles } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError } from '../../utils';
import { getPhaseAsDecisionAdmin } from './phaseHelpers';
import { mutatePhaseRows } from './phaseRows';

export const deletePhase = async ({
  user,
  phaseId,
}: {
  user: User;
  phaseId: string;
}): Promise<void> => {
  const phase = await getPhaseAsDecisionAdmin({ user, phaseId });

  await db.transaction((tx) =>
    mutatePhaseRows({
      db: tx,
      processInstanceId: phase.processInstanceId,
      mutate: async ({ rows }) => {
        const row = rows.find(({ id }) => id === phaseId);
        if (!row) {
          throw new NotFoundError('Phase', phaseId);
        }

        // The profile cascades to the phase row, not the other way round.
        await tx.delete(profiles).where(eq(profiles.id, row.profileId));
      },
    }),
  );
};
