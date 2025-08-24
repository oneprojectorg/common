import { and, db, eq, inArray } from '@op/db/client';
import { profileRelationships, profiles } from '@op/db/schema';

import { ValidationError } from '../../utils/error';
import { getCurrentProfileId } from '../access';

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
}): Promise<void> => {
  const currentProfileId = await getCurrentProfileId(authUserId);

  // Prevent self-relationships
  if (currentProfileId === targetProfileId) {
    throw new ValidationError('You cannot create a relationship with yourself');
  }

  // Try to create the relationship - unique constraint will prevent duplicates
  await db
    .insert(profileRelationships)
    .values({
      sourceProfileId: currentProfileId,
      targetProfileId,
      relationshipType: relationshipType as 'following' | 'likes',
      pending,
    })
    .onConflictDoNothing();
};

export const removeRelationship = async ({
  targetProfileId,
  relationshipType,
  authUserId,
}: {
  targetProfileId: string;
  relationshipType: string;
  authUserId: string;
}): Promise<void> => {
  const currentProfileId = await getCurrentProfileId(authUserId);

  if (!currentProfileId) {
    throw new ValidationError('You must be logged in to remove a relationship');
  }

  // Delete the specific relationship
  await db
    .delete(profileRelationships)
    .where(
      and(
        eq(profileRelationships.sourceProfileId, currentProfileId),
        eq(profileRelationships.targetProfileId, targetProfileId),
        eq(
          profileRelationships.relationshipType,
          relationshipType as 'following' | 'likes',
        ),
      ),
    );
};

export const getRelationships = async ({
  targetProfileId,
  sourceProfileId,
  authUserId,
}: {
  targetProfileId?: string;
  sourceProfileId?: string;
  authUserId: string;
}): Promise<
  Array<{
    relationshipType: string;
    pending: boolean | null;
    createdAt: string | null;
    targetProfile?: {
      id: string;
      name: string;
      slug: string;
      bio: string | null;
      avatarImage: string | null;
      type: string;
    };
    sourceProfile?: {
      id: string;
      name: string;
      slug: string;
      bio: string | null;
      avatarImage: string | null;
      type: string;
    };
  }>
> => {
  const currentProfileId = await getCurrentProfileId(authUserId);

  if (!currentProfileId) {
    throw new ValidationError('You must be logged in to view relationships');
  }

  // Build the where conditions
  const conditions = [];

  if (sourceProfileId) {
    conditions.push(eq(profileRelationships.sourceProfileId, sourceProfileId));
  } else if (!targetProfileId) {
    // If neither sourceProfileId nor targetProfileId is provided, default to current user as source
    conditions.push(eq(profileRelationships.sourceProfileId, currentProfileId));
  }

  if (targetProfileId) {
    conditions.push(eq(profileRelationships.targetProfileId, targetProfileId));
  }

  // Get unique profile IDs first to fetch in bulk
  const relationships = await db
    .select({
      id: profileRelationships.id,
      relationshipType: profileRelationships.relationshipType,
      pending: profileRelationships.pending,
      createdAt: profileRelationships.createdAt,
      sourceProfileId: profileRelationships.sourceProfileId,
      targetProfileId: profileRelationships.targetProfileId,
    })
    .from(profileRelationships)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  if (relationships.length === 0) {
    return [];
  }

  // Get all unique profile IDs
  const profileIds = new Set<string>();
  relationships.forEach((rel) => {
    profileIds.add(rel.sourceProfileId);
    profileIds.add(rel.targetProfileId);
  });

  // Fetch all profiles in a single query
  const allProfiles = await db
    .select({
      id: profiles.id,
      name: profiles.name,
      slug: profiles.slug,
      bio: profiles.bio,
      avatarImage: profiles.avatarImageId,
      type: profiles.type,
    })
    .from(profiles)
    .where(inArray(profiles.id, [...profileIds]));

  // Create a lookup map for profiles
  const profileMap = new Map();
  allProfiles.forEach((profile) => {
    profileMap.set(profile.id, profile);
  });

  // Combine the data
  return relationships.map((rel) => ({
    relationshipType: rel.relationshipType,
    pending: rel.pending,
    createdAt: rel.createdAt,
    sourceProfile: profileMap.get(rel.sourceProfileId),
    targetProfile: profileMap.get(rel.targetProfileId),
  }));
};
