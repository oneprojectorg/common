import { type DbClient, and, db, eq, sql } from '@op/db/client';
import {
  JoinProfileRequestStatus,
  joinProfileRequests,
  organizations,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { CommonError, ValidationError } from '../../../utils';
import { assertGlobalRole } from '../../assert';
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

  if (existingMembership) {
    throw new ValidationError('You are already a member of this profile');
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
        // Resolve the role before the transaction to avoid the cache/allowList
        // call inside joinOrganization acquiring a separate DB connection
        const memberRole = await assertGlobalRole('Member');

        const updated = await db.transaction(async (tx) => {
          await performAutoJoin(user, matchedOrg, memberRole.id, tx);

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
    const memberRole = await assertGlobalRole('Member');

    const inserted = await db.transaction(async (tx) => {
      await performAutoJoin(user, matchedOrg, memberRole.id, tx);

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

  const [org] = await db
    .select()
    .from(organizations)
    .where(
      and(
        eq(organizations.profileId, targetProfileId),
        sql`lower(${organizations.domain}) = ${userEmailDomain}`,
      ),
    )
    .limit(1);

  return org ?? null;
}

async function performAutoJoin(
  user: User,
  organization: Organization,
  roleId: string,
  db: DbClient,
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
    roleId,
    db,
  });
}
