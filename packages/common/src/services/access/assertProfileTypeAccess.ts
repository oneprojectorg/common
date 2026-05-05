import { db } from '@op/db/client';
import { EntityType, profiles } from '@op/db/schema';
import type { AccessZonePermission, NormalizedRole } from 'access-zones';
import { assertAccess, permission } from 'access-zones';
import { inArray } from 'drizzle-orm';

import { ValidationError } from '../../utils/error';
import { getNormalizedRoles } from './utils';

// Per-profile-type permission policy. Omitting a type from the record means
// that type is NOT gated — the caller is opting into lenient pass-through
// for, e.g., regular org or individual profiles.
export type ProfileTypePolicies = Partial<
  Record<EntityType, AccessZonePermission>
>;

export type AssertProfileTypeAccessOptions = {
  user: { id: string };
  profileIds: string[];
  policies: ProfileTypePolicies;
};

// Authorizes a user against a list of profiles, dispatching on profile type.
// Two batched queries: one for profile types, one for the user's profileUser
// rows (with role graph) across every gated profile. Profile ADMIN always
// satisfies the check. Types not present in `policies` are treated as no-op
// (lenient).
export const assertProfileTypeAccess = async ({
  user,
  profileIds,
  policies,
}: AssertProfileTypeAccessOptions) => {
  const uniqueProfileIds = [...new Set(profileIds)];
  if (uniqueProfileIds.length === 0) {
    return;
  }

  const profileRows = await db
    .select({ id: profiles.id, type: profiles.type })
    .from(profiles)
    .where(inArray(profiles.id, uniqueProfileIds));

  if (profileRows.length !== uniqueProfileIds.length) {
    throw new ValidationError('One or more profileIds do not exist');
  }

  const gatedRows = profileRows.flatMap((row) => {
    const requiredPermission = policies[row.type as EntityType];
    return requiredPermission ? [{ id: row.id, requiredPermission }] : [];
  });
  if (gatedRows.length === 0) {
    return;
  }

  const profileUsers = await db.query.profileUsers.findMany({
    where: {
      authUserId: user.id,
      profileId: { in: gatedRows.map((row) => row.id) },
    },
    with: {
      roles: {
        with: {
          accessRole: {
            with: {
              zonePermissions: {
                with: { accessZone: true },
              },
            },
          },
        },
      },
    },
  });

  const rolesByProfileId = new Map<string, NormalizedRole[]>(
    profileUsers.map((profileUser) => [
      profileUser.profileId,
      getNormalizedRoles(profileUser.roles),
    ]),
  );

  for (const row of gatedRows) {
    assertAccess(
      [{ profile: permission.ADMIN }, row.requiredPermission],
      rolesByProfileId.get(row.id) ?? [],
    );
  }
};
