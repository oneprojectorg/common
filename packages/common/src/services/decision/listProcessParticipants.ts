import { and, db, eq, isNull, ne } from '@op/db/client';
import { ProposalStatus, profileUsers, proposals } from '@op/db/schema';
import { union } from 'drizzle-orm/pg-core';

export type ProcessParticipant = {
  authUserId: string;
  /** Null for anonymous accounts, which are participants with no address. */
  email: string | null;
};

/**
 * Everyone taking part in a decision instance: the people listed in the
 * Members panel (profileUsers on the process profile) plus everyone attached
 * to a proposal in the instance — creators and the collaborators they invited.
 *
 * Deliberately blind to proposal visibility: a hidden proposal still has an
 * author who is a participant. Draft and soft-deleted proposals are the only
 * ones that carry no participation.
 *
 * Channel-agnostic on purpose. Anonymous participants are returned with a null
 * email rather than dropped, so a caller that later reaches them by another
 * channel still sees them; an email sender filters with `hasEmail`.
 *
 * Uncached and unauthorized: the audience is derived from the instance, never
 * requested by a caller, and a stale cache here means someone silently misses
 * a notification.
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

  // UNION already collapses identical rows, but the same person can hold
  // profileUsers rows carrying different emails (process profile vs proposal
  // profile), so the identity dedupe has to be on authUserId. The set is
  // whole-instance and never paginated, so folding it here is safe.
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
