import { db } from '@op/db/client';
import type { AccessZonePermission } from 'access-zones';
import { assertAccess, permission } from 'access-zones';

import { getProfileAccessUser } from './index';

export type AssertDecisionProfilesAccessOptions = {
  user: { id: string };
  profileIds: string[];
  requiredPermission: AccessZonePermission;
};

// Authorizes a user against a list of profiles for a decision-related action.
// Profiles that aren't backed by a processInstance are treated as a no-op so
// non-decision posts (regular org/proposal feeds) keep their previous lenient
// behavior. Profile ADMIN always satisfies the check.
export const assertDecisionProfilesAccess = async ({
  user,
  profileIds,
  requiredPermission,
}: AssertDecisionProfilesAccessOptions) => {
  await Promise.all(
    profileIds.map(async (profileId) => {
      const [decisionInstance, profileUser] = await Promise.all([
        db.query.processInstances.findFirst({
          where: { profileId },
          columns: { profileId: true },
        }),
        getProfileAccessUser({ user, profileId }),
      ]);
      if (!decisionInstance) {
        return;
      }
      assertAccess(
        [{ profile: permission.ADMIN }, requiredPermission],
        profileUser?.roles ?? [],
      );
    }),
  );
};
