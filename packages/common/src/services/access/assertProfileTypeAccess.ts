import { db } from '@op/db/client';
import type { EntityType } from '@op/db/schema';
import type { AccessZonePermission } from 'access-zones';
import { assertAccess, permission } from 'access-zones';

import { getProfileAccessUser } from './index';

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
// One batched type lookup, then per-profile permission assertion using the
// caller-supplied policy for that type. Profile ADMIN always satisfies the
// check. Types not present in `policies` are treated as no-op (lenient).
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

  await Promise.all(
    profileRows.map(async (row) => {
      const requiredPermission = lookupPolicy(row.type);
      if (!requiredPermission) {
        return;
      }
      const profileUser = await getProfileAccessUser({
        user,
        profileId: row.id,
      });
      assertAccess(
        [{ profile: permission.ADMIN }, requiredPermission],
        profileUser?.roles ?? [],
      );
    }),
  );
};
