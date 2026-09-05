import { and, db, eq, isNull } from '@op/db/client';
import { profileUsers, proposals } from '@op/db/schema';
import { union } from 'drizzle-orm/pg-core';

import {
  type EmailRecipient,
  profileMemberRecipients,
} from '../email/recipients';

/**
 * Everyone taking part in a decision instance: process-profile members plus
 * everyone attached to a non-deleted proposal in it, drafts included — a
 * draft author has started taking part and phase changes affect them
 * (notably the submission window closing).
 *
 * Blind to proposal visibility — hiding a proposal is moderation, not
 * un-enrolment. Uncached: a stale audience means someone misses a
 * notification.
 */
export async function listProcessParticipants({
  processInstanceId,
}: {
  processInstanceId: string;
}): Promise<Array<EmailRecipient>> {
  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: { profileId: true },
  });

  const processProfileId = instance?.profileId;

  if (!processProfileId) {
    return [];
  }

  const members = profileMemberRecipients().where(
    eq(profileUsers.profileId, processProfileId),
  );

  const proposalAuthors = profileMemberRecipients()
    .innerJoin(proposals, eq(proposals.profileId, profileUsers.profileId))
    .where(
      and(
        eq(proposals.processInstanceId, processInstanceId),
        isNull(proposals.deletedAt),
      ),
    );

  // Addresses are sourced per authUserId, so UNION's row dedupe is the
  // identity dedupe: a member who also submitted appears once.
  return union(members, proposalAuthors);
}
