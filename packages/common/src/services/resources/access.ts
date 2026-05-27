import { db } from '@op/db/client';
import {
  EntityType,
  profiles,
  resourceCollectionItems,
  resourceCollectionProfiles,
} from '@op/db/schema';
import { checkPermission, permission } from 'access-zones';
import { eq } from 'drizzle-orm';

import { UnauthorizedError } from '../../utils/error';
import { getProfileAccessUser } from '../access';

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

export type AssertResourceAccessInput = {
  scope: ResourceScope;
  authUserId: string;
  level: ResourceAccessLevel;
};

// Resources only attach to DECISION-type profiles. Because a collection /
// resource can be on multiple decision profiles (M:N), we need "any-of"
// semantics — the user passes if they hold the required role on at least one
// member profile. `assertProfileTypeAccess` checks every profile, which is
// the wrong shape for M:N. Instead we look up the user's roles on each
// candidate (cached per `(profileId, authUserId)`) and probe with
// `checkPermission` — the same pattern used by `assertInstanceProfileAccess`.
export const assertResourceAccess = async ({
  scope,
  authUserId,
  level,
}: AssertResourceAccessInput): Promise<ResolvedScope> => {
  const candidates = await candidateProfilesForScope(scope);
  const decisionCandidates = candidates.filter(
    (c) => c.type === EntityType.DECISION,
  );
  if (decisionCandidates.length === 0) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  const policy = decisionPolicy(level);
  const profileAccessUsers = await Promise.all(
    decisionCandidates.map((candidate) =>
      getProfileAccessUser({
        user: { id: authUserId },
        profileId: candidate.id,
      }),
    ),
  );

  for (const [index, candidate] of decisionCandidates.entries()) {
    const roles = profileAccessUsers[index]?.roles ?? [];
    if (checkPermission([{ profile: permission.ADMIN }, policy], roles)) {
      return {
        profileId: candidate.id,
        profileType: EntityType.DECISION,
      };
    }
  }

  throw new UnauthorizedError("You don't have access to do this");
};
