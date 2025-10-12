import { db, eq, lt, sql } from '@op/db/client';
import { atprotoOAuthSessions } from '@op/db/schema';

interface CreateSessionData {
  state: string;
  codeVerifier: string;
  handle: string;
  did?: string;
  redirectUri: string;
  dpopKeyPair: string;
  expiresAt: Date;
}

export const createSession = async (data: CreateSessionData) => {
  const [session] = await db
    .insert(atprotoOAuthSessions)
    .values({
      state: data.state,
      codeVerifier: data.codeVerifier,
      handle: data.handle,
      did: data.did || null,
      redirectUri: data.redirectUri,
      dpopKeyPair: data.dpopKeyPair,
      createdAt: sql`now()`,
      expiresAt: data.expiresAt.toISOString(),
    })
    .returning();

  return session;
};

export const getSessionByState = async (state: string) => {
  const session = await db.query.atprotoOAuthSessions.findFirst({
    where: eq(atprotoOAuthSessions.state, state),
  });

  return session;
};

export const deleteSession = async (state: string) => {
  await db
    .delete(atprotoOAuthSessions)
    .where(eq(atprotoOAuthSessions.state, state));
};

export const cleanupExpiredSessions = async () => {
  const now = new Date().toISOString();

  const result = await db
    .delete(atprotoOAuthSessions)
    .where(lt(atprotoOAuthSessions.expiresAt, now))
    .returning({ id: atprotoOAuthSessions.id });

  return result.length;
};
