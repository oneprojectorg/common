import { and, db, eq, ilike, isNotNull, isNull } from '@op/db/client';
import { profileInvites } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

/**
 * List invites for the current user by email.
 * No special access check needed - user can only query their own email.
 */
export const listMyInvites = async ({
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

  const invites = await db._query.profileInvites.findMany({
    where: and(...conditions),
    with: {
      accessRole: true,
      profile: {
        with: {
          avatarImage: true,
          processInstance: {
            with: {
              owner: {
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
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  return invites;
};
