import { and, db, eq, or, sql } from '@op/db/client';
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

export type ProfileUserOrderBy = 'name' | 'email' | 'role';

/**
 * List all members of a profile
 */
export const listProfileUsers = async ({
  profileId,
  user,
  orderBy = 'name',
  dir = 'asc',
  query,
}: {
  profileId: string;
  user: User;
  orderBy?: ProfileUserOrderBy;
  dir?: SortDir;
  query?: string;
}): Promise<ProfileUserWithRelations[]> => {
  const [profileAccessUser] = await Promise.all([
    getProfileAccessUser({ user, profileId }),
    assertProfile(profileId),
  ]);

  if (!profileAccessUser) {
    throw new UnauthorizedError('You do not have access to this profile');
  }

  assertAccess({ profile: permission.ADMIN }, profileAccessUser.roles ?? []);

  // Build where clause with optional search filter (minimum 2 characters)
  // Searches user's profile name (via profiles.search with GIN index) and profileUsers.email
  const searchFilter =
    query && query.length >= 2
      ? (() => {
          const tsQuery = query.trim().replaceAll(' ', '\\ ') + ':*';
          // Subquery to search the user's profile name via the profiles.search tsvector
          const profileSearchSubquery = sql`EXISTS (
            SELECT 1 FROM ${users} u
            INNER JOIN ${profiles} p ON p.id = u.profile_id
            WHERE u.auth_user_id = ${profileUsers.authUserId}
            AND p.search @@ to_tsquery('english', ${tsQuery})
          )`;
          // Also search profileUsers.email
          const emailSearch = sql`to_tsvector('english', ${profileUsers.email}) @@ to_tsquery('english', ${tsQuery})`;
          return or(profileSearchSubquery, emailSearch);
        })()
      : undefined;

  const whereClause = searchFilter
    ? and(eq(profileUsers.profileId, profileId), searchFilter)
    : eq(profileUsers.profileId, profileId);

  // Fetch all profile users with their roles and user profiles
  const profileUserResults = await db._query.profileUsers.findMany({
    where: whereClause,
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
          ORDER BY ar.name
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
