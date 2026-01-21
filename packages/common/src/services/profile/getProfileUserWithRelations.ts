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
 * Used for fetching a single profile user with serviceUser.profile and roles.accessRole.
 */
type ProfileUserWithRelations = ProfileUser & {
  serviceUser: {
    profile: (Profile & { avatarImage: ObjectsInStorage | null }) | null;
  } | null;
  roles: Array<{
    accessRole: AccessRole;
  }>;
};

/**
 * Fetch a single profile user with full relations.
 * Returns the same shape as items from listProfileUsers.
 */
export const getProfileUserWithRelations = async (profileUserId: string) => {
  const profileUser = await db._query.profileUsers.findFirst({
    where: eq(profileUsers.id, profileUserId),
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
  });

  if (!profileUser) {
    return null;
  }

  const typedProfileUser = profileUser as ProfileUserWithRelations;
  const userProfile = typedProfileUser.serviceUser?.profile;

  return {
    id: profileUser.id,
    authUserId: profileUser.authUserId,
    name: userProfile?.name || profileUser.name,
    email: profileUser.email,
    about: userProfile?.bio || profileUser.about,
    profileId: profileUser.profileId,
    createdAt: profileUser.createdAt,
    updatedAt: profileUser.updatedAt,
    profile: userProfile ?? null,
    roles: profileUser.roles.map((roleJunction) => roleJunction.accessRole),
  };
};

export type ProfileUserWithRelationsResult = NonNullable<
  Awaited<ReturnType<typeof getProfileUserWithRelations>>
>;
