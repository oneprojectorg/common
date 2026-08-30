import { and, db, eq, isNull, ne } from '@op/db/client';
import { ProposalStatus, profileUsers, proposals } from '@op/db/schema';
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

  const members = db
    .select({
      authUserId: profileUsers.authUserId,
      email: profileUsers.email,
    })
    .from(profileUsers)
    .where(eq(profileUsers.profileId, processProfileId));

  const proposalAuthors = db
    .select({
      authUserId: profileUsers.authUserId,
      email: profileUsers.email,
    })
    .from(profileUsers)
    .innerJoin(proposals, eq(proposals.profileId, profileUsers.profileId))
    .where(
      and(
        eq(proposals.processInstanceId, processInstanceId),
        ne(proposals.status, ProposalStatus.DRAFT),
        isNull(proposals.deletedAt),
      ),
    );

  const rows = await union(members, proposalAuthors);

  // UNION collapses identical rows, but one person can hold profileUsers rows
  // carrying different emails, so identity dedupe has to be on authUserId.
  const byAuthUserId = new Map<string, ProcessParticipant>();

  for (const row of rows) {
    const existing = byAuthUserId.get(row.authUserId);

    // First row wins, except that an address beats no address.
    if (!existing) {
      byAuthUserId.set(row.authUserId, row);
    } else if (!existing.email && row.email) {
      byAuthUserId.set(row.authUserId, row);
    }
  }

  return [...byAuthUserId.values()];
}
