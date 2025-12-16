import { invalidate } from '@op/cache';
import { and, db, eq, inArray } from '@op/db/client';
import type { ProfileRelationshipType } from '@op/db/schema';
import { profileRelationships } from '@op/db/schema';

import { ValidationError } from '../../utils/error';
import { getCurrentProfileId } from '../access';

/** Profile shape returned from relationship queries */
type RelationshipProfile = {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  type: string;
  avatarImage: { id: string; name: string | null } | null;
};

export const addRelationship = async ({
  targetProfileId,
  relationshipType,
  authUserId,
  pending = false,
}: {
  targetProfileId: string;
  relationshipType: string;
  authUserId: string;
  pending?: boolean;
}): Promise<{ sourceProfileId: string }> => {
  const currentProfileId = await getCurrentProfileId(authUserId);

  // Prevent self-relationships
  if (currentProfileId === targetProfileId) {
    throw new ValidationError('You cannot create a relationship with yourself');
  }

  // Try to create the relationship - unique constraint will prevent duplicates
  await Promise.all([
    db
      .insert(profileRelationships)
      .values({
        sourceProfileId: currentProfileId,
        targetProfileId,
        relationshipType: relationshipType as ProfileRelationshipType,
        pending,
      })
      .onConflictDoNothing(),
    invalidate({
      type: 'profile',
      params: [targetProfileId],
    }),
  ]);

  return { sourceProfileId: currentProfileId };
};

export const removeRelationship = async ({
  targetProfileId,
  relationshipType,
  authUserId,
}: {
  targetProfileId: string;
  relationshipType: string;
  authUserId: string;
}): Promise<{ sourceProfileId: string }> => {
  const currentProfileId = await getCurrentProfileId(authUserId);

  if (!currentProfileId) {
    throw new ValidationError('You must be logged in to remove a relationship');
  }

  // Delete the specific relationship
  await Promise.all([
    db
      .delete(profileRelationships)
      .where(
        and(
          eq(profileRelationships.sourceProfileId, currentProfileId),
          eq(profileRelationships.targetProfileId, targetProfileId),
          eq(
            profileRelationships.relationshipType,
            relationshipType as ProfileRelationshipType,
          ),
        ),
      ),
    invalidate({
      type: 'profile',
      params: [targetProfileId],
    }),
  ]);

  return { sourceProfileId: currentProfileId };
};

/**
 * Retrieves profile relationships with full profile details using Drizzle relational queries.
 * Both sourceProfile and targetProfile are guaranteed to exist in the return type.
 */
export const getRelationships = async ({
  targetProfileId,
  sourceProfileId,
  relationshipTypes,
  profileType,
  authUserId,
}: {
  targetProfileId?: string;
  sourceProfileId?: string;
  relationshipTypes?: string[];
  profileType?: string;
  authUserId: string;
}): Promise<
  Array<{
    relationshipType: string;
    pending: boolean | null;
    createdAt: string | null;
    targetProfile: {
      id: string;
      name: string;
      slug: string;
      bio: string | null;
      avatarImage: { id: string; name: string | null } | null;
      type: string;
    };
    sourceProfile: {
      id: string;
      name: string;
      slug: string;
      bio: string | null;
      avatarImage: { id: string; name: string | null } | null;
      type: string;
    };
  }>
> => {
  const currentProfileId = await getCurrentProfileId(authUserId);

  if (!currentProfileId) {
    throw new ValidationError('You must be logged in to view relationships');
  }

  // Determine the effective source profile ID for filtering
  const effectiveSourceProfileId =
    sourceProfileId ?? (!targetProfileId ? currentProfileId : undefined);

  const relationships = await db.query.profileRelationships.findMany({
    where: and(
      effectiveSourceProfileId
        ? eq(profileRelationships.sourceProfileId, effectiveSourceProfileId)
        : undefined,
      targetProfileId
        ? eq(profileRelationships.targetProfileId, targetProfileId)
        : undefined,
      relationshipTypes && relationshipTypes.length > 0
        ? inArray(
            profileRelationships.relationshipType,
            relationshipTypes as ProfileRelationshipType[],
          )
        : undefined,
    ),
    with: {
      sourceProfile: {
        columns: {
          id: true,
          name: true,
          slug: true,
          bio: true,
          type: true,
        },
        with: {
          avatarImage: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      },
      targetProfile: {
        columns: {
          id: true,
          name: true,
          slug: true,
          bio: true,
          type: true,
        },
        with: {
          avatarImage: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  // Filter by profileType if specified (applied post-query since relational queries
  // don't support filtering on nested relations)
  const filtered = profileType
    ? relationships.filter((rel) => {
        const target = rel.targetProfile as RelationshipProfile;
        return target.type === profileType;
      })
    : relationships;

  return filtered.map((rel) => {
    // Type assertions needed because Drizzle infers union types when the same table
    // is referenced in multiple relations, even with relationName disambiguation
    const source = rel.sourceProfile as RelationshipProfile;
    const target = rel.targetProfile as RelationshipProfile;

    return {
      relationshipType: rel.relationshipType,
      pending: rel.pending,
      createdAt: rel.createdAt,
      sourceProfile: {
        id: source.id,
        name: source.name,
        slug: source.slug,
        bio: source.bio,
        avatarImage: source.avatarImage,
        type: source.type,
      },
      targetProfile: {
        id: target.id,
        name: target.name,
        slug: target.slug,
        bio: target.bio,
        avatarImage: target.avatarImage,
        type: target.type,
      },
    };
  });
};
