import { db } from '@op/db/client';
import { JoinProfileRequestStatus, joinProfileRequests } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { eq } from 'drizzle-orm';

import { UnauthorizedError, ValidationError } from '../../../utils';

/**
 * Deletes (cancels) a pending join profile request.
 * Only the user who created the request can delete it, and only if it's still pending.
 */
export const deleteJoinRequest = async ({
  user,
  requestId,
}: {
  user: User;
  /** The ID of the join profile request to delete */
  requestId: string;
}): Promise<void> => {
  // Find the existing request by ID
  const existingRequest = await db.query.joinProfileRequests.findFirst({
    where: (table, { eq }) => eq(table.id, requestId),
  });

  if (!existingRequest) {
    throw new ValidationError('Join request not found');
  }

  // Only pending requests can be deleted/cancelled
  if (existingRequest.status !== JoinProfileRequestStatus.PENDING) {
    throw new ValidationError('Only pending requests can be cancelled');
  }

  // Check authorization - user must own the requesting profile
  const requestingUser = await db.query.users.findFirst({
    where: (table, { and, eq }) =>
      and(
        eq(table.authUserId, user.id),
        eq(table.profileId, existingRequest.requestProfileId),
      ),
  });

  if (!requestingUser) {
    throw new UnauthorizedError(
      'You can only cancel join requests from your own profile',
    );
  }

  await db
    .delete(joinProfileRequests)
    .where(eq(joinProfileRequests.id, requestId));
};
