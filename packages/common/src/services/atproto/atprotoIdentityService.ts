import { db, eq } from '@op/db/client';
import { atprotoIdentities } from '@op/db/schema';

import { encryptToken, decryptToken } from './encryption';

interface CreateIdentityData {
  userId: string;
  did: string;
  handle: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiry: Date;
}

export const createIdentity = async (data: CreateIdentityData) => {
  const [identity] = await db
    .insert(atprotoIdentities)
    .values({
      userId: data.userId,
      did: data.did,
      handle: data.handle,
      email: data.email,
      displayName: data.displayName || null,
      avatarUrl: data.avatarUrl || null,
      bio: data.bio || null,
      accessToken: encryptToken(data.accessToken),
      refreshToken: data.refreshToken ? encryptToken(data.refreshToken) : null,
      tokenExpiry: data.tokenExpiry.toISOString(),
    })
    .returning();

  return identity;
};

export const getIdentityByDid = async (did: string) => {
  const identity = await db.query.atprotoIdentities.findFirst({
    where: eq(atprotoIdentities.did, did),
  });

  if (!identity) {
    return null;
  }

  return {
    ...identity,
    accessToken: decryptToken(identity.accessToken),
    refreshToken: identity.refreshToken
      ? decryptToken(identity.refreshToken)
      : null,
  };
};

export const getIdentityByEmail = async (email: string) => {
  const identity = await db.query.atprotoIdentities.findFirst({
    where: eq(atprotoIdentities.email, email),
  });

  if (!identity) {
    return null;
  }

  return {
    ...identity,
    accessToken: decryptToken(identity.accessToken),
    refreshToken: identity.refreshToken
      ? decryptToken(identity.refreshToken)
      : null,
  };
};

export const getIdentityByUserId = async (userId: string) => {
  const identity = await db.query.atprotoIdentities.findFirst({
    where: eq(atprotoIdentities.userId, userId),
  });

  if (!identity) {
    return null;
  }

  return {
    ...identity,
    accessToken: decryptToken(identity.accessToken),
    refreshToken: identity.refreshToken
      ? decryptToken(identity.refreshToken)
      : null,
  };
};

interface UpdateTokensData {
  accessToken: string;
  refreshToken?: string;
  tokenExpiry: Date;
}

export const updateTokens = async (
  identityId: string,
  tokens: UpdateTokensData
) => {
  const [updatedIdentity] = await db
    .update(atprotoIdentities)
    .set({
      accessToken: encryptToken(tokens.accessToken),
      refreshToken: tokens.refreshToken
        ? encryptToken(tokens.refreshToken)
        : null,
      tokenExpiry: tokens.tokenExpiry.toISOString(),
    })
    .where(eq(atprotoIdentities.id, identityId))
    .returning();

  return updatedIdentity;
};

export const deleteIdentity = async (identityId: string) => {
  await db
    .delete(atprotoIdentities)
    .where(eq(atprotoIdentities.id, identityId));
};
