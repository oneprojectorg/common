import { db, eq, sql } from '@op/db/client';
import { profileUsers } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { UnauthorizedError } from '../../utils/error';
import { getProfileAccessUser } from '../access';
import { assertProfile } from '../assert';
import type {
  ProfileUserQueryResult,
  ProfileUserWithRelations,
} from './getProfileUserWithRelations';

import type { SortDir } from '../../utils/db';

export type ProfileUserOrderBy = 'name' | 'email' | 'role';

/**
 * List all members of a profile
 */
export const listProfileUsers = async ({
  profileId,
  user,
  orderBy = 'name',
  dir = 'asc',
}: {
  profileId: string;
  user: User;
  orderBy?: ProfileUserOrderBy;
  dir?: SortDir;
}): Promise<ProfileUserWithRelations[]> => {
  const [profileAccessUser] = await Promise.all([
    getProfileAccessUser({ user, profileId }),
    assertProfile(profileId),
  ]);

  if (!profileAccessUser) {
    throw new UnauthorizedError('You do not have access to this profile');
  }

  assertAccess({ profile: permission.ADMIN }, profileAccessUser.roles ?? []);

  // Fetch all profile users with their roles and user profiles
  const profileUserResults = await db._query.profileUsers.findMany({
    where: eq(profileUsers.profileId, profileId),
    with: {
      roles: {
        with: {
          accessRole: true,
        },
      },
      serviceUser: {
        with: {
          profile: {
            with: {
              avatarImage: true,
            },
          },
        },
      },
    },
    orderBy: (table, { asc, desc }) => {
      const orderFn = dir === 'desc' ? desc : asc;

      if (orderBy === 'role') {
        // Use a subquery to get the first role name for sorting
        // Note: Using raw SQL strings because Drizzle's sql template uses outer query aliases
        const roleNameSubquery = sql`(
          SELECT ar.name
          FROM "profileUser_to_access_roles" pur
          INNER JOIN "access_roles" ar ON ar.id = pur.access_role_id
          WHERE pur.profile_user_id = ${table.id}
          LIMIT 1
        )`;
        return [orderFn(roleNameSubquery)];
      }

      if (orderBy === 'email') {
        return [orderFn(table.email)];
      }

      // Default to name
      return [orderFn(table.name)];
    },
  });

  return profileUserResults.map((result) => {
    const { serviceUser, roles, ...baseProfileUser } =
      result as ProfileUserQueryResult;
    const userProfile = serviceUser?.profile;

    return {
      ...baseProfileUser,
      name: userProfile?.name || baseProfileUser.name,
      about: userProfile?.bio || baseProfileUser.about,
      profile: userProfile ?? null,
      roles: roles.map((roleJunction) => roleJunction.accessRole),
    };
  });
};
