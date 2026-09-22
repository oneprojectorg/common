import { db } from '@op/db/client';
import { EntityType, profiles } from '@op/db/schema';
import type { AccessZonePermission, NormalizedRole } from 'access-zones';
import { assertAccess, permission } from 'access-zones';
import { inArray } from 'drizzle-orm';

import { ValidationError } from '../../utils/error';
import { type AccessUser, resolveAccessUserIds } from './index';
import { getNormalizedRoles, zonePermissionsWhere } from './utils';

// Per-profile-type permission policy. Omitting a type from the record means
// that type is NOT gated — the caller is opting into lenient pass-through
// for, e.g., regular org or individual profiles.
//
// PHASE is therefore spelled out at every call site that gates DECISION, even
// where no phase profile can reach it yet: omitting it is a read that succeeds
// and should not, with no compile error to catch it. The bit chosen is the one
// the site already requires of DECISION. That is deliberately conservative —
// a phase profile's grants are per-capability, so almost nobody holds
// `decisions: ADMIN` on one — and not yet the resolution rule, which puts
// manage on the process and participation on the phase.
export type ProfileTypePolicies = Partial<
  Record<EntityType, AccessZonePermission>
>;

export type AssertProfileTypeAccessOptions = {
  user?: AccessUser;
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
    // `enumToPgEnum` widens enum columns to `string`; narrowing here until
    // the helper preserves literal types.
    const requiredPermission = policies[row.type as EntityType];
    return requiredPermission ? [{ id: row.id, requiredPermission }] : [];
  });
  if (gatedRows.length === 0) {
    return;
  }

  // A caller's effective access is the union of their own grants and any
  // public (GLOBAL_USER_PUBLIC) grant; a no-JWT caller resolves only the public
  // sentinel. Never a raw undefined (fail-open).
  const authUserIds = resolveAccessUserIds(user);

  const profileUsers = await db.query.profileUsers.findMany({
    where: {
      authUserId: { in: authUserIds },
      profileId: { in: gatedRows.map((row) => row.id) },
    },
    with: {
      roles: {
        with: {
          accessRole: {
            with: {
              zonePermissions: {
                // Narrowed to the whole batch; getNormalizedRoles scopes
                // each profileUser's rows to its own profile.
                where: zonePermissionsWhere(gatedRows.map((row) => row.id)),
                with: { accessZone: true },
              },
            },
          },
        },
      },
    },
  });

  // Merge roles across the caller's own and public grants per profile.
  const rolesByProfileId = new Map<string, NormalizedRole[]>();
  for (const profileUser of profileUsers) {
    const existing = rolesByProfileId.get(profileUser.profileId) ?? [];
    rolesByProfileId.set(profileUser.profileId, [
      ...existing,
      ...getNormalizedRoles(profileUser.roles, {
        profileId: profileUser.profileId,
      }),
    ]);
  }

  for (const row of gatedRows) {
    assertAccess(
      [{ profile: permission.ADMIN }, row.requiredPermission],
      rolesByProfileId.get(row.id) ?? [],
    );
  }
};
