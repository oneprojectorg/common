import { db } from '@op/db/client';
import {
  EntityType,
  profileUsers,
  profiles,
  resourceCollectionItems,
  resourceCollectionProfiles,
} from '@op/db/schema';
import { permission } from 'access-zones';
import { and, eq, sql } from 'drizzle-orm';

import { UnauthorizedError } from '../../utils/error';
import { assertProfileTypeAccess, getCurrentProfileId } from '../access';

export type ResourceScope =
  | { kind: 'profile'; profileId: string }
  | { kind: 'collection'; collectionId: string }
  | { kind: 'resource'; resourceId: string };

export type ResourceAccessLevel = 'read' | 'write';

export type ResolvedScope = {
  profileId: string;
  profileType: EntityType;
};

export type AssertResourceAccessInput = {
  scope: ResourceScope;
  authUserId: string;
  level: ResourceAccessLevel;
};

const decisionPolicy = (level: ResourceAccessLevel) =>
  level === 'write'
    ? { decisions: permission.ADMIN }
    : { decisions: permission.READ };

// Pre-narrow to one profile. Collections/resources can be shared across
// multiple decision profiles (M:N); bias toward `currentProfileId` so a user
// who's a member of more than one resolves deterministically to their acting
// profile, not whichever happens to sort first.
const resolveActingProfileId = async ({
  scope,
  authUserId,
}: {
  scope: ResourceScope;
  authUserId: string;
}): Promise<string | null> => {
  const currentProfileId = await getCurrentProfileId(authUserId).catch(
    () => null,
  );
  const preferCurrent = sql`(CASE WHEN ${profiles.id} = ${currentProfileId ?? null} THEN 0 ELSE 1 END)`;

  if (scope.kind === 'profile') {
    const [row] = await db
      .select({ profileId: profiles.id })
      .from(profiles)
      .innerJoin(profileUsers, eq(profileUsers.profileId, profiles.id))
      .where(
        and(
          eq(profiles.id, scope.profileId),
          eq(profiles.type, EntityType.DECISION),
          eq(profileUsers.authUserId, authUserId),
        ),
      )
      .limit(1);
    return row?.profileId ?? null;
  }

  if (scope.kind === 'collection') {
    const [row] = await db
      .select({ profileId: profiles.id })
      .from(resourceCollectionProfiles)
      .innerJoin(
        profiles,
        eq(profiles.id, resourceCollectionProfiles.profileId),
      )
      .innerJoin(profileUsers, eq(profileUsers.profileId, profiles.id))
      .where(
        and(
          eq(resourceCollectionProfiles.collectionId, scope.collectionId),
          eq(profiles.type, EntityType.DECISION),
          eq(profileUsers.authUserId, authUserId),
        ),
      )
      .orderBy(preferCurrent, profiles.id)
      .limit(1);
    return row?.profileId ?? null;
  }

  const [row] = await db
    .select({ profileId: profiles.id })
    .from(resourceCollectionItems)
    .innerJoin(
      resourceCollectionProfiles,
      eq(
        resourceCollectionProfiles.collectionId,
        resourceCollectionItems.collectionId,
      ),
    )
    .innerJoin(profiles, eq(profiles.id, resourceCollectionProfiles.profileId))
    .innerJoin(profileUsers, eq(profileUsers.profileId, profiles.id))
    .where(
      and(
        eq(resourceCollectionItems.resourceId, scope.resourceId),
        eq(profiles.type, EntityType.DECISION),
        eq(profileUsers.authUserId, authUserId),
      ),
    )
    .orderBy(preferCurrent, profiles.id)
    .limit(1);
  return row?.profileId ?? null;
};

export const assertResourceAccess = async ({
  scope,
  authUserId,
  level,
}: AssertResourceAccessInput): Promise<ResolvedScope> => {
  const profileId = await resolveActingProfileId({ scope, authUserId });
  if (!profileId) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  await assertProfileTypeAccess({
    user: { id: authUserId },
    profileIds: [profileId],
    policies: {
      [EntityType.DECISION]: decisionPolicy(level),
    },
  });

  return {
    profileId,
    profileType: EntityType.DECISION,
  };
};
