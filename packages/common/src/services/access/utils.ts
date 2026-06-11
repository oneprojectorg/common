import { NormalizedRole } from 'access-zones';

// Manual type definitions to work around Zod 3->4 upgrade incompatibility
type AccessZone = {
  id: string;
  name: string;
  description?: string | null;
};

type AccessRolePermissionOnAccessZone = {
  accessRoleId: string;
  accessZoneId: string;
  permission: number;
  // NULL/absent = global row, set = per-profile override row
  profileId?: string | null;
};

interface ZonePermission extends AccessRolePermissionOnAccessZone {
  accessZone: AccessZone;
}

interface AccessRole {
  id: string;
  name: string;
  description?: string | null;
  zonePermissions?: ZonePermission[];
}

/**
 * Filters permission rows down to the ones in effect for a profile, applying
 * the scoping rules of `accessRolePermissionsOnAccessZones.profileId`:
 *
 * - global rows (`profileId IS NULL`) apply everywhere the role is granted
 * - profile-scoped rows apply only to their profile, and when both a global
 *   and a scoped row exist for the same key the scoped row OVERRIDES the
 *   global one (so a per-profile row can restrict below the global baseline)
 * - with no `profileId` only global rows survive (fail closed: a scoped row
 *   never leaks outside its profile)
 *
 * `keyOf` defines the override granularity — typically the (role, zone) pair.
 */
export const pickEffectivePermissionRows = <
  T extends { profileId?: string | null },
>(
  rows: T[],
  keyOf: (row: T) => string,
  profileId?: string | null,
): T[] => {
  const effective = new Map<string, T>();

  for (const row of rows) {
    const rowProfileId = row.profileId ?? null;

    if (rowProfileId !== null && rowProfileId !== profileId) {
      continue;
    }

    const current = effective.get(keyOf(row));

    if (current && (current.profileId ?? null) !== null) {
      // A scoped row already won this key
      continue;
    }

    if (!current || rowProfileId !== null) {
      effective.set(keyOf(row), row);
    }
  }

  return [...effective.values()];
};

type ZonePermissionsWhere =
  | { profileId: { isNull: true } }
  | {
      OR: [
        { profileId: { isNull: true } },
        { profileId: string } | { profileId: { in: string[] } },
      ];
    };

/**
 * Reusable relational `where` for `zonePermissions` loads: keeps a role's
 * global rows plus the rows scoped to the given profile(s). This is the SQL
 * twin of {@link pickEffectivePermissionRows} — a fetch-size optimization, not
 * the safety net: normalization still scopes and overrides in JS, so a load
 * that omits this filter only over-fetches, it can't leak.
 */
export const zonePermissionsWhere = (
  profileId?: string | string[] | null,
): ZonePermissionsWhere => {
  if (!profileId || profileId.length === 0) {
    return { profileId: { isNull: true } };
  }

  return {
    OR: [
      { profileId: { isNull: true } },
      Array.isArray(profileId)
        ? { profileId: { in: profileId } }
        : { profileId },
    ],
  };
};

/**
 * Normalizes Drizzle role-junction rows into access-zones `NormalizedRole`s.
 *
 * `profileId` scopes which zone-permission rows apply (see
 * {@link pickEffectivePermissionRows}): pass the profile being checked in
 * profile contexts; omit it in org/global contexts so only global rows count.
 */
export const getNormalizedRoles = (
  roleJunctions: Array<{ accessRole: AccessRole }>,
  options?: { profileId?: string | null },
): NormalizedRole[] =>
  roleJunctions.map((roleJunction) => {
    const role = roleJunction.accessRole;

    // Build the access object with zone names as keys and permission bitfields as values
    const access: Record<string, number> = {};

    const effectiveRows = pickEffectivePermissionRows(
      role.zonePermissions ?? [],
      (row) => row.accessZoneId,
      options?.profileId,
    );

    effectiveRows.forEach((zonePermission) => {
      // Use zone name as key, permission bitfield as value
      access[zonePermission.accessZone.name] = zonePermission.permission;
    });

    return {
      id: role.id,
      name: role.name,
      access,
    };
  });
