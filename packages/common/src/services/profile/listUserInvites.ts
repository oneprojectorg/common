import { db } from '@op/db/client';
import {
  type AccessRole,
  type ObjectsInStorage,
  type Profile,
  type ProfileInvite,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';

type ProfileWithAvatar = Profile & {
  avatarImage: ObjectsInStorage | null;
};

type ProfileInviteWithProfile = ProfileInvite & {
  accessRole: AccessRole | null;
  profile: ProfileWithAvatar | null;
  inviter: ProfileWithAvatar | null;
};

/**
 * List invites for the current user by email.
 * No special access check needed - user can only query their own email.
 */
export const listUserInvites = async ({
  user,
  entityType,
  pending,
}: {
  user: User;
  entityType?: string;
  pending?: boolean;
}): Promise<ProfileInviteWithProfile[]> => {
  if (!user.email) {
    return [];
  }

  const invites = (await db.query.profileInvites.findMany({
    where: {
      email: { ilike: user.email },
      ...(pending === true && { acceptedOn: { isNull: true } }),
      ...(pending === false && { acceptedOn: { isNotNull: true } }),
      ...(entityType && { profileEntityType: entityType }),
    },
    with: {
      accessRole: true,
      profile: {
        with: {
          avatarImage: true,
        },
      },
      inviter: {
        with: {
          avatarImage: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })) as ProfileInviteWithProfile[];

  return invites;
};
