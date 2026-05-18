import { db } from '@op/db/client';
import {
  EntityType,
  profiles,
  resourceCollectionItems,
  resourceCollectionProfiles,
} from '@op/db/schema';
import { permission } from 'access-zones';
import { eq } from 'drizzle-orm';

import { UnauthorizedError } from '../../utils/error';
import { assertProfileTypeAccess } from '../access/assertProfileTypeAccess';

export type ResourceScope =
  | { kind: 'profile'; profileId: string }
  | { kind: 'collection'; collectionId: string }
  | { kind: 'resource'; resourceId: string };

export type ResourceAccessLevel = 'read' | 'write';

export type ResolvedScope = {
  profileId: string;
  profileType: EntityType;
};

// For collection and resource scopes the entity can live on many profiles
// (M:N via resource_collection_profiles and resource_collection_items). We
// pick the first profile the auth user actually has access to.
const candidateProfilesForScope = async (
  scope: ResourceScope,
): Promise<Array<{ id: string; type: string }>> => {
  if (scope.kind === 'profile') {
    const [row] = await db
      .select({ id: profiles.id, type: profiles.type })
      .from(profiles)
      .where(eq(profiles.id, scope.profileId))
      .limit(1);
    return row ? [row] : [];
  }

  if (scope.kind === 'collection') {
    return db
      .select({ id: profiles.id, type: profiles.type })
      .from(resourceCollectionProfiles)
      .innerJoin(
        profiles,
        eq(profiles.id, resourceCollectionProfiles.profileId),
      )
      .where(eq(resourceCollectionProfiles.collectionId, scope.collectionId));
  }

  return db
    .select({ id: profiles.id, type: profiles.type })
    .from(resourceCollectionItems)
    .innerJoin(
      resourceCollectionProfiles,
      eq(
        resourceCollectionProfiles.collectionId,
        resourceCollectionItems.collectionId,
      ),
    )
    .innerJoin(profiles, eq(profiles.id, resourceCollectionProfiles.profileId))
    .where(eq(resourceCollectionItems.resourceId, scope.resourceId));
};

const decisionPolicy = (level: ResourceAccessLevel) =>
  level === 'write'
    ? { decisions: permission.ADMIN }
    : { decisions: permission.READ };

export const assertResourceAccess = async (
  scope: ResourceScope,
  authUserId: string,
  level: ResourceAccessLevel,
): Promise<ResolvedScope> => {
  const candidates = await candidateProfilesForScope(scope);
  if (candidates.length === 0) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  for (const candidate of candidates) {
    if (candidate.type !== EntityType.DECISION) {
      continue;
    }
    try {
      await assertProfileTypeAccess({
        user: { id: authUserId },
        profileIds: [candidate.id],
        policies: {
          [EntityType.DECISION]: decisionPolicy(level),
        },
      });
      return {
        profileId: candidate.id,
        profileType: candidate.type as EntityType,
      };
    } catch {
      // Try next candidate profile.
    }
  }

  throw new UnauthorizedError("You don't have access to do this");
};
