import { and, db, eq, ilike, isNotNull, isNull } from '@op/db/client';
import {
  type AccessRole,
  type ObjectsInStorage,
  type Profile,
  type ProfileInvite,
  profileInvites,
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

  // Build where conditions
  const conditions = [ilike(profileInvites.email, user.email)];

  if (pending === true) {
    conditions.push(isNull(profileInvites.acceptedOn));
  } else if (pending === false) {
    conditions.push(isNotNull(profileInvites.acceptedOn));
  }

  if (entityType) {
    conditions.push(eq(profileInvites.profileEntityType, entityType));
  }

  const invites = (await db._query.profileInvites.findMany({
    where: and(...conditions),
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
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  })) as ProfileInviteWithProfile[];

  return invites;
};
