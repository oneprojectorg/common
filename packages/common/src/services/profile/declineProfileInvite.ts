import { db, sql } from '@op/db/client';
import { profileInvites } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { CommonError, UnauthorizedError } from '../../utils/error';

/**
 * Decline a profile invite by hard-deleting the invite record.
 * Verifies user email matches invite email (case-insensitive).
 */
export const declineProfileInvite = async ({
  inviteId,
  user,
}: {
  inviteId: string;
  user: User;
}) => {
  // Find the pending invite
  const invite = await db.query.profileInvites.findFirst({
    where: {
      id: inviteId,
      acceptedOn: { isNull: true },
    },
  });

  if (!invite) {
    throw new CommonError('Invite not found or already processed');
  }

  // Verify user email matches invite email (case-insensitive)
  if (invite.email.toLowerCase() !== user.email?.toLowerCase()) {
    throw new UnauthorizedError('This invite is for a different email address');
  }

  // Hard-delete the invite
  const [deleted] = await db
    .delete(profileInvites)
    .where(
      sql`${profileInvites.id} = ${inviteId} AND ${profileInvites.acceptedOn} IS NULL`,
    )
    .returning({ id: profileInvites.id });

  if (!deleted) {
    throw new CommonError('Failed to decline invite');
  }

  return { success: true };
};
