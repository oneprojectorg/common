import { type TransactionType, db, eq } from '@op/db/client';
import {
  JoinProfileRequestStatus,
  joinProfileRequests,
  organizations,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { CommonError } from '../../../utils';
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

  // Already a member — upsert an APPROVED request record and return
  if (existingMembership) {
    const [record] = existingRequest
      ? await db
          .update(joinProfileRequests)
          .set({
            status: JoinProfileRequestStatus.APPROVED,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(joinProfileRequests.id, existingRequest.id))
          .returning()
      : await db
          .insert(joinProfileRequests)
          .values({
            requestProfileId,
            targetProfileId,
            status: JoinProfileRequestStatus.APPROVED,
          })
          .returning();

    if (!record) {
      throw new CommonError('Failed to upsert join profile request');
    }

    return { ...record, requestProfile, targetProfile };
  }

  const matchedOrg = await findDomainMatchedOrg(user, targetProfileId);
  const isDomainMatched = !!matchedOrg;

  if (existingRequest) {
    // Previously rejected or still pending — if domain matches, auto-approve
    if (
      existingRequest.status === JoinProfileRequestStatus.REJECTED ||
      (existingRequest.status === JoinProfileRequestStatus.PENDING &&
        isDomainMatched)
    ) {
      const newStatus = isDomainMatched
        ? JoinProfileRequestStatus.APPROVED
        : JoinProfileRequestStatus.PENDING;

      if (matchedOrg) {
        const updated = await db.transaction(async (tx) => {
          await performAutoJoin(user, matchedOrg, tx);

          const [record] = await tx
            .update(joinProfileRequests)
            .set({
              status: newStatus,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(joinProfileRequests.id, existingRequest.id))
            .returning();

          return record;
        });

        if (!updated) {
          throw new CommonError('Failed to update join profile request');
        }

        return { ...updated, requestProfile, targetProfile };
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

      return { ...updated, requestProfile, targetProfile };
    }

    // PENDING without domain match or APPROVED — already in progress
    return { ...existingRequest, requestProfile, targetProfile };
  }

  // New request — auto-join if domain matches, then create the record
  if (matchedOrg) {
    const inserted = await db.transaction(async (tx) => {
      await performAutoJoin(user, matchedOrg, tx);

      const [record] = await tx
        .insert(joinProfileRequests)
        .values({
          requestProfileId,
          targetProfileId,
          status: JoinProfileRequestStatus.APPROVED,
        })
        .returning();

      return record;
    });

    if (!inserted) {
      throw new CommonError('Failed to create join profile request');
    }

    return { ...inserted, requestProfile, targetProfile };
  }

  const [inserted] = await db
    .insert(joinProfileRequests)
    .values({
      requestProfileId,
      targetProfileId,
    })
    .returning();

  if (!inserted) {
    throw new CommonError('Failed to create join profile request');
  }

  return { ...inserted, requestProfile, targetProfile };
};

type Organization = typeof organizations.$inferSelect;

/**
 * Returns the org if the user's email domain matches, null otherwise.
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
  tx?: TransactionType,
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
    tx,
  });
}
