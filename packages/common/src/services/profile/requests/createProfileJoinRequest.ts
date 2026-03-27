import { db, eq } from '@op/db/client';
import {
  JoinProfileRequestStatus,
  joinProfileRequests,
  organizations,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { CommonError, ConflictError } from '../../../utils';
import { joinOrganization } from '../../organization/joinOrganization';
import { JoinProfileRequestWithProfiles } from './types';
import { validateJoinProfileRequestContext } from './validateJoinProfileRequestContext';

/**
 * Creates a new request from one profile to join another profile.
 * If the user's email domain matches the target organization's domain,
 * auto-joins and marks the request as approved immediately.
 * Returns the join profile request with associated profiles.
 */
export const createProfileJoinRequest = async ({
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

  // Already a member — return success without creating a new request
  if (existingMembership) {
    if (existingRequest) {
      return {
        ...existingRequest,
        status: JoinProfileRequestStatus.APPROVED,
        requestProfile,
        targetProfile,
      };
    }

    return {
      id: '00000000-0000-0000-0000-000000000000',
      requestProfileId,
      targetProfileId,
      status: JoinProfileRequestStatus.APPROVED,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      requestProfile,
      targetProfile,
    };
  }

  // Check domain match and fetch org in a single query
  const matchedOrg = await findDomainMatchedOrg(user, targetProfileId);
  const isDomainMatched = !!matchedOrg;

  if (existingRequest) {
    if (existingRequest.status === JoinProfileRequestStatus.REJECTED) {
      const newStatus = isDomainMatched
        ? JoinProfileRequestStatus.APPROVED
        : JoinProfileRequestStatus.PENDING;

      if (matchedOrg) {
        await performAutoJoin(user, matchedOrg);
      }

      const [updated] = await db
        .update(joinProfileRequests)
        .set({
          status: newStatus,
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

  if (matchedOrg) {
    await performAutoJoin(user, matchedOrg);
  }

  const [inserted] = await db
    .insert(joinProfileRequests)
    .values({
      requestProfileId,
      targetProfileId,
      status: isDomainMatched ? JoinProfileRequestStatus.APPROVED : undefined,
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

type Organization = typeof organizations.$inferSelect;

/**
 * Returns the org if the user's email domain matches, null otherwise.
 * Single query replaces the old checkDomainMatch + autoJoinOrganization double-fetch.
 */
async function findDomainMatchedOrg(
  user: User,
  targetProfileId: string,
): Promise<Organization | null> {
  const userEmailDomain = user.email?.split('@')[1]?.toLowerCase();
  if (!userEmailDomain) {
    return null;
  }

  const org = await db.query.organizations.findFirst({
    where: { profileId: targetProfileId },
  });

  if (!org?.domain || userEmailDomain !== org.domain.toLowerCase()) {
    return null;
  }

  return org;
}

async function performAutoJoin(
  user: User,
  organization: Organization,
): Promise<void> {
  const commonUser = await db.query.users.findFirst({
    where: { authUserId: user.id },
  });

  if (!commonUser) {
    throw new CommonError('User record not found');
  }

  await joinOrganization({
    user: commonUser,
    organization,
  });
}
