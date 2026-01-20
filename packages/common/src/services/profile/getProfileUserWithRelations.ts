import { db, eq } from '@op/db/client';
import {
  type AccessRole,
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
    profile:
      | (Pick<Profile, 'id' | 'name' | 'slug' | 'bio' | 'email' | 'type'> & {
          avatarImage: { id: string; name: string | null } | null;
        })
      | null;
  } | null;
  roles: Array<{
    accessRole: Pick<AccessRole, 'id' | 'name' | 'description'>;
  }>;
};

/**
 * Fetch a single profile user with full relations.
 * Returns the same shape as items from listProfileUsers.
 */
export const getProfileUserWithRelations = async (profileUserId: string) => {
  const member = await db._query.profileUsers.findFirst({
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

  if (!member) {
    return null;
  }

  const typedMember = member as ProfileUserWithRelations;
  const userProfile = typedMember.serviceUser?.profile;

  return {
    id: member.id,
    authUserId: member.authUserId,
    name: userProfile?.name || member.name,
    email: member.email,
    about: userProfile?.bio || member.about,
    profileId: member.profileId,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
    profile: userProfile
      ? {
          id: userProfile.id,
          name: userProfile.name,
          slug: userProfile.slug,
          bio: userProfile.bio,
          email: userProfile.email,
          type: userProfile.type,
          avatarImage: userProfile.avatarImage
            ? {
                id: userProfile.avatarImage.id,
                name: userProfile.avatarImage.name,
              }
            : null,
        }
      : null,
    roles: member.roles.map((roleJunction) => ({
      id: roleJunction.accessRole.id,
      name: roleJunction.accessRole.name,
      description: roleJunction.accessRole.description,
    })),
  };
};

export type ProfileUserWithRelationsResult = NonNullable<
  Awaited<ReturnType<typeof getProfileUserWithRelations>>
>;
