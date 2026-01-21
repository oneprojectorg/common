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

/**
 * Type for profile user query result with relations.
 * Used for listProfileUsers which includes serviceUser.profile and roles.accessRole.
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
 * List all members of a profile
 */
export const listProfileUsers = async ({
  profileId,
  user,
}: {
  profileId: string;
  user: User;
}) => {
  const [profileAccessUser] = await Promise.all([
    getProfileAccessUser({ user, profileId }),
    assertProfile(profileId),
  ]);

  if (!profileAccessUser) {
    throw new UnauthorizedError('You do not have access to this profile');
  }

  assertAccess({ profile: permission.ADMIN }, profileAccessUser.roles ?? []);

  // Fetch all profile users with their roles and user profiles
  const members = await db._query.profileUsers.findMany({
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

  // Transform the data to a simpler format
  return members.map((member) => {
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
      profile: userProfile ?? null,
      roles: member.roles.map((roleJunction) => roleJunction.accessRole),
    };
  });
};
