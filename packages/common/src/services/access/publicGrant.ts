import type { NormalizedRole } from 'access-zones';

/** The global role a public grant hangs off. Seeded with no permissions. */
export const PUBLIC_ROLE_NAME = 'Public';

/**
 * Whether a resolved role set came from a public grant.
 *
 * `resolveAccessUserIds` unions the `GLOBAL_USER_PUBLIC` sentinel into every
 * caller's lookup, so the `Public` role appears in the roles of anyone looking
 * at a profile that is open — members and no-JWT visitors alike. Read this to
 * answer "is this profile public", and never a capability bit: a capability
 * answers what the caller may do, which is a different question and drifts the
 * moment the grant changes.
 *
 * Free to call — it reads roles the caller already resolved.
 *
 * Lives apart from `publicAccess.ts` so it stays importable from a test and
 * from client-safe code: that module reaches the database and is server-only.
 */
export const rolesIncludePublicGrant = (
  roles: Pick<NormalizedRole, 'name'>[],
): boolean => roles.some((role) => role.name === PUBLIC_ROLE_NAME);
