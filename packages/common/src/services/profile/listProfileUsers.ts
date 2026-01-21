import { db, eq } from '@op/db/client';
import {
  type AccessRole,
  type ObjectsInStorage,
  type Profile,
  type ProfileUser,
  profileUsers,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { UnauthorizedError } from '../../utils/error';
import { getProfileAccessUser } from '../access';
import { assertProfile } from '../assert';
import type { ProfileUserWithRelations } from './getProfileUserWithRelations';

/**
 * Type for profile user query result with relations.
 */
type ProfileUserQueryResult = ProfileUser & {
  serviceUser: {
    profile: (Profile & { avatarImage: ObjectsInStorage | null }) | null;
  } | null;
  roles: Array<{
    accessRole: AccessRole;
  }>;
};

/**
 * List all members of a profile
 */
export const listProfileUsers = async ({
  profileId,
  user,
}: {
  profileId: string;
  user: User;
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
    orderBy: (table, { asc }) => [asc(table.name), asc(table.email)],
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
