import { and, db, eq, isNull, ne } from '@op/db/client';
import {
  ProposalStatus,
  authUsers,
  profileUsers,
  proposals,
} from '@op/db/schema';
import { union } from 'drizzle-orm/pg-core';

export type ProcessParticipant = {
  authUserId: string;
  /** Null for anonymous accounts. */
  email: string | null;
};

/**
 * Everyone taking part in a decision instance: process-profile members plus
 * everyone attached to a non-draft, non-deleted proposal in it.
 *
 * Blind to proposal visibility — hiding a proposal is moderation, not
 * un-enrolment. Uncached: a stale audience means someone misses a
 * notification.
 */
export async function listProcessParticipants({
  processInstanceId,
}: {
  processInstanceId: string;
}): Promise<Array<ProcessParticipant>> {
  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: { profileId: true },
  });

  const processProfileId = instance?.profileId;

  if (!processProfileId) {
    return [];
  }

  // Email comes from auth.users, not profileUsers: the profileUsers copy is a
  // snapshot taken at insert time and nothing syncs it after an email change.
  const members = db
    .select({
      authUserId: profileUsers.authUserId,
      email: authUsers.email,
    })
    .from(profileUsers)
    .innerJoin(authUsers, eq(authUsers.id, profileUsers.authUserId))
    .where(eq(profileUsers.profileId, processProfileId));

  const proposalAuthors = db
    .select({
      authUserId: profileUsers.authUserId,
      email: authUsers.email,
    })
    .from(profileUsers)
    .innerJoin(authUsers, eq(authUsers.id, profileUsers.authUserId))
    .innerJoin(proposals, eq(proposals.profileId, profileUsers.profileId))
    .where(
      and(
        eq(proposals.processInstanceId, processInstanceId),
        ne(proposals.status, ProposalStatus.DRAFT),
        isNull(proposals.deletedAt),
      ),
    );

  // With the email sourced per authUserId, UNION's row dedupe is the identity
  // dedupe — one person can no longer surface under two different addresses.
  return union(members, proposalAuthors);
}
