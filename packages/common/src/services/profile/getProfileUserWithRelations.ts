import { db, eq } from '@op/db/client';
import {
  type AccessRole,
  type ObjectsInStorage,
  type Profile,
  type ProfileUser,
  profileUsers,
} from '@op/db/schema';

/**
 * Type for profile user query result with relations.
 */
export type ProfileUserQueryResult = ProfileUser & {
  serviceUser: {
    profile: (Profile & { avatarImage: ObjectsInStorage | null }) | null;
  } | null;
  roles: Array<{
    accessRole: AccessRole;
  }>;
};

type ProfileWithAvatar = Profile & { avatarImage: ObjectsInStorage | null };

/**
 * Return type for getProfileUserWithRelations.
 */
export type ProfileUserWithRelations = ProfileUser & {
  profile: ProfileWithAvatar | null;
  roles: AccessRole[];
  status?: 'active' | 'pending';
  inviteId?: string;
};

/**
 * Fetch a single profile user with full relations.
 * Returns the same shape as items from listProfileUsers.
 */
export const getProfileUserWithRelations = async (
  profileUserId: string,
): Promise<ProfileUserWithRelations | null> => {
  const profileUser = await db._query.profileUsers.findFirst({
    where: eq(profileUsers.id, profileUserId),
    with: {
      serviceUser: {
        with: {
          profile: {
            with: {
              avatarImage: true,
            },
          },
        },
      },
      roles: {
        with: {
          accessRole: true,
        },
      },
    },
  });

  if (!profileUser) {
    return null;
  }

  const { serviceUser, roles, ...baseProfileUser } =
    profileUser as ProfileUserQueryResult;
  const userProfile = serviceUser?.profile;

  return {
    ...baseProfileUser,
    name: userProfile?.name || baseProfileUser.name,
    about: userProfile?.bio || baseProfileUser.about,
    profile: userProfile ?? null,
    roles: roles.map((roleJunction) => roleJunction.accessRole),
  };
};
