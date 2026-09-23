import { and, db, eq, isNotNull, isNull } from '@op/db/client';
import { authUsers, profileUsers, proposals } from '@op/db/schema';
import { union } from 'drizzle-orm/pg-core';

import type { EmailRecipient } from '../email/recipients';

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
        isNull(proposals.deletedAt),
      ),
    );

  // With the email sourced per authUserId, UNION's row dedupe is the identity
  // dedupe — one person can no longer surface under two different addresses.
  return union(members, proposalAuthors);
}

export interface SmsOnlyParticipant {
  authUserId: string;
  phone: string;
}

const hasPhone = <T extends { phone: string | null }>(
  row: T,
): row is T & { phone: string } => Boolean(row.phone);

/**
 * The same audience as {@link listProcessParticipants}, narrowed to accounts
 * with a confirmed phone and no email — participants email notifications
 * already drop entirely.
 */
export async function listSmsOnlyProcessParticipants({
  processInstanceId,
}: {
  processInstanceId: string;
}): Promise<Array<SmsOnlyParticipant>> {
  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: { profileId: true },
  });

  const processProfileId = instance?.profileId;

  if (!processProfileId) {
    return [];
  }

  const smsOnly = and(isNull(authUsers.email), isNotNull(authUsers.phone));

  const members = db
    .select({
      authUserId: profileUsers.authUserId,
      phone: authUsers.phone,
    })
    .from(profileUsers)
    .innerJoin(authUsers, eq(authUsers.id, profileUsers.authUserId))
    .where(and(eq(profileUsers.profileId, processProfileId), smsOnly));

  const proposalAuthors = db
    .select({
      authUserId: profileUsers.authUserId,
      phone: authUsers.phone,
    })
    .from(profileUsers)
    .innerJoin(authUsers, eq(authUsers.id, profileUsers.authUserId))
    .innerJoin(proposals, eq(proposals.profileId, profileUsers.profileId))
    .where(
      and(
        eq(proposals.processInstanceId, processInstanceId),
        isNull(proposals.deletedAt),
        smsOnly,
      ),
    );

  const rows = await union(members, proposalAuthors);

  return rows.filter(hasPhone);
}
