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

/**
 * The name the API returns for a profile user: the linked profile's name when
 * the user has a profile, otherwise the denormalized `profileUsers.name`,
 * which is null or stale for profile-linked users. `listProfileUsers` sorts
 * and paginates on the SQL equivalent of this, so the two must stay in sync.
 */
export const resolveDisplayName = (
  result: ProfileUserQueryResult,
): string | null => result.serviceUser?.profile?.name || result.name;

type ProfileWithAvatar = Profile & { avatarImage: ObjectsInStorage | null };

/**
 * Return type for getProfileUserWithRelations.
 */
export type ProfileUserWithRelations = ProfileUser & {
  profile: ProfileWithAvatar | null;
  roles: AccessRole[];
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

  const result = profileUser as ProfileUserQueryResult;
  const { serviceUser, roles, ...baseProfileUser } = result;
  const userProfile = serviceUser?.profile;

  return {
    ...baseProfileUser,
    name: resolveDisplayName(result),
    about: userProfile?.bio || baseProfileUser.about,
    profile: userProfile ?? null,
    roles: roles.map((roleJunction) => roleJunction.accessRole),
  };
};
