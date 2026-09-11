import { db, eq } from '@op/db/client';
import { users } from '@op/db/schema';
import type { NormalizedRole } from 'access-zones';
import { checkPermission, permission } from 'access-zones';

import { type AccessUser, resolveAccountUserId } from './cacheKeys';
import { memoize } from './requestCache';
import { getNormalizedRoles, zonePermissionsWhere } from './utils';

export const PLATFORM_ZONE_NAME = 'platform';

export const PLATFORM_ADMIN_ROLE_NAME = 'Platform Admin';

// Global roles that count at the user level when held on the own profile; widening this is a security decision.
export const USER_LEVEL_GLOBAL_ROLE_NAMES: readonly string[] = [
  PLATFORM_ADMIN_ROLE_NAME,
];

/**
 * The roles on the caller's OWN individual-profile membership that are global
 * AND named in {@link USER_LEVEL_GLOBAL_ROLE_NAMES}. Both filters matter: the
 * signup trigger grants every user the global `Admin` role on their own profile.
 */
export const getUserGlobalRoles = memoize(
  async ({ user }: { user?: AccessUser }): Promise<NormalizedRole[]> => {
    const authUserId = resolveAccountUserId(user);

    if (!authUserId) {
      return [];
    }

    const memberships = await db.query.profileUsers.findMany({
      where: {
        authUserId,
        // Own individual profile, resolved in the same statement.
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
