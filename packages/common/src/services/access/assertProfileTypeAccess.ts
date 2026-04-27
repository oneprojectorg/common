import { db } from '@op/db/client';
import type { EntityType } from '@op/db/schema';
import type { AccessZonePermission, NormalizedRole } from 'access-zones';
import { assertAccess, permission } from 'access-zones';

import { type RoleJunction, getNormalizedRoles } from './utils';

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
  if (profileIds.length === 0) {
    return;
  }

  const profileRows = await db.query.profiles.findMany({
    where: { id: { in: profileIds } },
    columns: { id: true, type: true },
  });

  // `enumToPgEnum` widens entity-type columns to plain `string`, so we
  // narrow at the lookup site rather than threading the cast through the
  // policy map type.
  const lookupPolicy = (type: string) =>
    (policies as Record<string, AccessZonePermission | undefined>)[type];

  // Pair every gated profile with its required permission once, so the
  // assertion loop doesn't re-look-up.
  const gatedRows = profileRows.flatMap((row) => {
    const requiredPermission = lookupPolicy(row.type);
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

  const rolesByProfileId = new Map<string, NormalizedRole[]>();
  for (const profileUser of profileUsers) {
    rolesByProfileId.set(
      profileUser.profileId,
      getNormalizedRoles(
        profileUser.roles as Array<Pick<RoleJunction, 'accessRole'>>,
      ),
    );
  }

  for (const row of gatedRows) {
    assertAccess(
      [{ profile: permission.ADMIN }, row.requiredPermission],
      rolesByProfileId.get(row.id) ?? [],
    );
  }
};
