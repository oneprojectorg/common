import { db, eq, lt, sql } from '@op/db/client';
import { atprotoPartialSessions } from '@op/db/schema';

import { encryptToken, decryptToken } from './encryption';

interface CreatePartialSessionData {
  did: string;
  handle: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiry: Date;
  expiresAt: Date;
}

export const createPartialSession = async (data: CreatePartialSessionData) => {
  const [session] = await db
    .insert(atprotoPartialSessions)
    .values({
      did: data.did,
      handle: data.handle,
      displayName: data.displayName || null,
      avatarUrl: data.avatarUrl || null,
      bio: data.bio || null,
      accessToken: encryptToken(data.accessToken),
      refreshToken: data.refreshToken ? encryptToken(data.refreshToken) : null,
      tokenExpiry: data.tokenExpiry.toISOString(),
      createdAt: sql`now()`,
      expiresAt: data.expiresAt.toISOString(),
    })
    .returning();

  return session;
};

export const getPartialSession = async (id: string) => {
  const session = await db.query.atprotoPartialSessions.findFirst({
    where: eq(atprotoPartialSessions.id, id),
  });

  if (!session) {
    return null;
  }

  return {
    ...session,
    accessToken: decryptToken(session.accessToken),
    refreshToken: session.refreshToken
      ? decryptToken(session.refreshToken)
      : null,
  };
};

export const deletePartialSession = async (id: string) => {
  await db
    .delete(atprotoPartialSessions)
    .where(eq(atprotoPartialSessions.id, id));
};

export const cleanupExpiredSessions = async () => {
  const now = new Date().toISOString();

  const result = await db
    .delete(atprotoPartialSessions)
    .where(lt(atprotoPartialSessions.expiresAt, now))
    .returning({ id: atprotoPartialSessions.id });

  return result.length;
};
