import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';

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
}) => {
  if (!user.email) {
    return [];
  }

  const invites = await db.query.profileInvites.findMany({
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
          processInstance: {
            with: {
              steward: {
                with: {
                  avatarImage: true,
                },
              },
            },
          },
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
  });

  return invites;
};
