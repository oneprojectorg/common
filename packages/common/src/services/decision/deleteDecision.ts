import { db, eq, inArray, or } from '@op/db/client';
import { processPhases, profiles } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { CommonError, NotFoundError } from '../../utils';
import { assertProfileAccess } from '../assert';

export const deleteDecision = async ({
  instanceId,
  user,
}: {
  instanceId: string;
  user: User;
}) => {
  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
  });

  if (!instance) {
    throw new NotFoundError('Decision', instanceId);
  }

  if (!instance.profileId) {
    throw new CommonError('Decision profile not found');
  }

  await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: [
      { decisions: permission.DELETE },
      { decisions: permission.ADMIN },
    ],
  });

  // Deleting the decision's profile cascades to the instance and all related
  // data, but not to phase profiles, which the phase rows point at.
  const decisionProfileId = instance.profileId;
  const deletedProfiles = await db
    .delete(profiles)
    .where(
      or(
        eq(profiles.id, decisionProfileId),
        inArray(
          profiles.id,
          db
            .select({ id: processPhases.profileId })
            .from(processPhases)
            .where(eq(processPhases.processInstanceId, instanceId)),
        ),
      ),
    )
    .returning({ id: profiles.id });

  if (!deletedProfiles.some(({ id }) => id === decisionProfileId)) {
    throw new CommonError('Failed to delete decision');
  }
};
