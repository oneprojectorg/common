import { db, eq } from '@op/db/client';
import { users } from '@op/db/schema';
import type { NormalizedRole } from 'access-zones';
import { checkPermission, permission } from 'access-zones';

import { type AccessUser, resolveAccountUserId } from './cacheKeys';
import { memoize } from './requestCache';
import { getNormalizedRoles, zonePermissionsWhere } from './utils';

/** The zone a platform-wide grant lives on. Seeded, never renamed. */
export const PLATFORM_ZONE_NAME = 'platform';

/** The global role that carries the platform-wide grant. Seeded. */
export const PLATFORM_ADMIN_ROLE_NAME = 'Platform Admin';

/**
 * The closed set of global roles that mean something at the *user* level when
 * held on the holder's own individual profile. Every other global role — most
 * of all `Admin`, which the signup trigger grants every user on their own
 * profile — stays a per-profile grant. Widening this list widens what a row on
 * an own-profile membership can do everywhere, so add to it deliberately.
 */
export const USER_LEVEL_GLOBAL_ROLE_NAMES: readonly string[] = [
  PLATFORM_ADMIN_ROLE_NAME,
];

/**
 * The caller's user-level roles: the roles held on the membership row of their
 * OWN individual profile (`users.profileId`) that are global
 * (`accessRoles.profileId IS NULL`) *and* named in
 * {@link USER_LEVEL_GLOBAL_ROLE_NAMES}.
 *
 * Both conditions carry weight. The own-profile anchor keeps a `Platform Admin`
 * row on some other membership (an org or decision profile) from reading as a
 * platform grant, and the name allowlist keeps the trigger-granted global
 * `Admin` role — which every user holds on their own profile — from reading as
 * one. Only global permission rows apply: a user-level role is unscoped, so a
 * per-profile override row must never narrow it.
 *
 * Memoized per request only; no durable cache, so a grant or revoke takes
 * effect on the next request.
 */
export const getUserGlobalRoles = memoize(
  async ({ user }: { user?: AccessUser }): Promise<NormalizedRole[]> => {
    const authUserId = resolveAccountUserId(user);

    // Fail closed: no account identity can hold a user-level role.
    if (!authUserId) {
      return [];
    }

    const memberships = await db.query.profileUsers.findMany({
      where: {
        authUserId,
        // The own individual profile, resolved in the same statement so the
        // anchor can never widen to "any membership row this user has".
        RAW: (table) =>
          eq(
            table.profileId,
            db
              .select({ profileId: users.profileId })
              .from(users)
              .where(eq(users.authUserId, authUserId)),
          ),
      },
      with: {
        roles: {
          with: {
            accessRole: {
              with: {
                zonePermissions: {
                  where: zonePermissionsWhere(),
                  with: {
                    accessZone: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const userLevelGrants = memberships.flatMap((membership) =>
      membership.roles.filter(
        ({ accessRole }) =>
          accessRole.profileId === null &&
          USER_LEVEL_GLOBAL_ROLE_NAMES.includes(accessRole.name),
      ),
    );

    return getNormalizedRoles(userLevelGrants);
  },
  ({ user }) => resolveAccountUserId(user) ?? '',
);

/** Whether the caller holds the platform-wide admin grant. */
export const isPlatformAdmin = async ({
  user,
}: {
  user?: AccessUser;
}): Promise<boolean> =>
  checkPermission(
    { [PLATFORM_ZONE_NAME]: permission.ADMIN },
    await getUserGlobalRoles({ user }),
  );
