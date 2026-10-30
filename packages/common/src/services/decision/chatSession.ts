import { and, db, eq, sql } from '@op/db/client';
import { type DecisionChatSession, decisionChatSessions } from '@op/db/schema';

import { NotFoundError } from '../../utils';
import { getIndividualProfileId } from '../access';

interface SessionKey {
  processInstanceId: string;
  authUserId: string;
}

const sessionFilter = (processInstanceId: string, profileId: string) =>
  and(
    eq(decisionChatSessions.processInstanceId, processInstanceId),
    eq(decisionChatSessions.profileId, profileId),
  );

export async function findChatSession({
  processInstanceId,
  authUserId,
}: SessionKey): Promise<DecisionChatSession | null> {
  const profileId = await getIndividualProfileId(authUserId);
  const session = await db.query.decisionChatSessions.findFirst({
    where: { processInstanceId, profileId },
  });
  return session ?? null;
}

export async function findLatestChatSession({
  authUserId,
  phoneNumberId,
}: {
  authUserId: string;
  /** Only sessions last browsed on this decision line. */
  phoneNumberId?: string;
}): Promise<DecisionChatSession | null> {
  const profileId = await getIndividualProfileId(authUserId);
  const [session] = await db.query.decisionChatSessions.findMany({
    where: { profileId, ...(phoneNumberId ? { phoneNumberId } : {}) },
    orderBy: { updatedAt: 'desc' },
    limit: 1,
  });
  return session ?? null;
}

export async function ensureChatSession({
  processInstanceId,
  authUserId,
  phoneNumberId,
}: SessionKey & {
  /** The decision line this browse came in on; omitted leaves the stored line as it is. */
  phoneNumberId?: string | null;
}): Promise<DecisionChatSession> {
  const profileId = await getIndividualProfileId(authUserId);
  await db
    .insert(decisionChatSessions)
    .values({
      processInstanceId,
      profileId,
      phoneNumberId: phoneNumberId ?? null,
    })
    .onConflictDoUpdate({
      target: [
        decisionChatSessions.processInstanceId,
        decisionChatSessions.profileId,
      ],
      set:
        phoneNumberId === undefined
          ? { updatedAt: sql`(now() AT TIME ZONE 'utc'::text)` }
          : { phoneNumberId, updatedAt: sql`(now() AT TIME ZONE 'utc'::text)` },
    });
  const session = await db.query.decisionChatSessions.findFirst({
    where: { processInstanceId, profileId },
  });

  if (!session) {
    throw new NotFoundError('Chat session', processInstanceId);
  }

  return session;
}

export async function setSessionPageCursor({
  processInstanceId,
  authUserId,
  pageCursor,
}: SessionKey & { pageCursor: number | null }): Promise<void> {
  const profileId = await getIndividualProfileId(authUserId);
  await db
    .update(decisionChatSessions)
    .set({ pageCursor, updatedAt: new Date().toISOString() })
    .where(sessionFilter(processInstanceId, profileId));
}

export async function markChatSessionReopened({
  processInstanceId,
  authUserId,
}: SessionKey): Promise<void> {
  const profileId = await getIndividualProfileId(authUserId);
  await db
    .update(decisionChatSessions)
    .set({ reopenedAt: new Date(), updatedAt: new Date().toISOString() })
    .where(sessionFilter(processInstanceId, profileId));
}

export async function clearChatSessionReopened({
  processInstanceId,
  authUserId,
}: SessionKey): Promise<void> {
  const profileId = await getIndividualProfileId(authUserId);
  await db
    .update(decisionChatSessions)
    .set({
      reopenedAt: null,
      updatedAt: sql`(now() AT TIME ZONE 'utc'::text)`,
    })
    .where(sessionFilter(processInstanceId, profileId));
}
