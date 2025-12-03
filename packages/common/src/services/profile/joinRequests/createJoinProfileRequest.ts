import { db } from '@op/db/client';
import { JoinProfileRequestStatus, joinProfileRequests } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { eq } from 'drizzle-orm';

import { CommonError, ConflictError, ValidationError } from '../../../utils';
import {
  JoinProfileRequestWithProfiles,
  validateJoinProfileRequestContext,
} from './validateJoinProfileRequestContext';

export type { JoinProfileRequestWithProfiles };

/**
 * Creates a new request from one profile to join another profile.
 * Returns the join profile request with associated profiles.
 */
export const createJoinProfileRequest = async ({
  user,
  requestProfileId,
  targetProfileId,
}: {
  user: User;
  requestProfileId: string;
  targetProfileId: string;
}): Promise<JoinProfileRequestWithProfiles> => {
  const { requestProfile, targetProfile, existingRequest, existingMembership } =
    await validateJoinProfileRequestContext({
      user,
      requestProfileId,
      targetProfileId,
    });

  // Check if user is already a member of the target profile
  if (existingMembership) {
    throw new ValidationError('You are already a member of this profile');
  }

  if (existingRequest) {
    // If previously rejected, reset to pending with updated timestamp
    if (existingRequest.status === JoinProfileRequestStatus.REJECTED) {
      const [updated] = await db
        .update(joinProfileRequests)
        .set({
          status: JoinProfileRequestStatus.PENDING,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(joinProfileRequests.id, existingRequest.id))
        .returning();

      if (!updated) {
        throw new CommonError('Failed to update join profile request');
      }

      return {
        ...updated,
        requestProfile,
        targetProfile,
      };
    }
    throw new ConflictError('A join request already exists for this profile');
  }

  const [inserted] = await db
    .insert(joinProfileRequests)
    .values({
      requestProfileId,
      targetProfileId,
      // will default to "pending"
    })
    .returning();

  if (!inserted) {
    throw new CommonError('Failed to create join profile request');
  }

  return {
    ...inserted,
    requestProfile,
    targetProfile,
  };
};
