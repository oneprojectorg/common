import { and, db, eq } from '@op/db/client';
import { alias } from 'drizzle-orm/pg-core';
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
  relationshipType,
  profileType,
  authUserId,
}: {
  targetProfileId?: string;
  sourceProfileId?: string;
  relationshipType?: string;
  profileType?: string;
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

  if (relationshipType) {
    conditions.push(
      eq(
        profileRelationships.relationshipType,
        relationshipType as 'following' | 'likes',
      ),
    );
  }

  // Build the query with profile joins to get everything in one query
  // Use aliases to distinguish between source and target profiles
  const sourceProfiles = alias(profiles, 'sourceProfiles');
  const targetProfiles = alias(profiles, 'targetProfiles');

  if (profileType) {
    // If profileType filtering is requested, we need to filter on target profiles
    const relationships = await db
      .select({
        id: profileRelationships.id,
        relationshipType: profileRelationships.relationshipType,
        pending: profileRelationships.pending,
        createdAt: profileRelationships.createdAt,
        sourceProfileId: profileRelationships.sourceProfileId,
        targetProfileId: profileRelationships.targetProfileId,
        sourceProfile: {
          id: sourceProfiles.id,
          name: sourceProfiles.name,
          slug: sourceProfiles.slug,
          bio: sourceProfiles.bio,
          avatarImage: sourceProfiles.avatarImageId,
          type: sourceProfiles.type,
        },
        targetProfile: {
          id: targetProfiles.id,
          name: targetProfiles.name,
          slug: targetProfiles.slug,
          bio: targetProfiles.bio,
          avatarImage: targetProfiles.avatarImageId,
          type: targetProfiles.type,
        },
      })
      .from(profileRelationships)
      .leftJoin(sourceProfiles, eq(profileRelationships.sourceProfileId, sourceProfiles.id))
      .leftJoin(targetProfiles, eq(profileRelationships.targetProfileId, targetProfiles.id))
      .where(
        conditions.length > 0
          ? and(...conditions, eq(targetProfiles.type, profileType))
          : eq(targetProfiles.type, profileType),
      );

    return relationships.map((rel) => ({
      relationshipType: rel.relationshipType,
      pending: rel.pending,
      createdAt: rel.createdAt,
      sourceProfile: rel.sourceProfile || undefined,
      targetProfile: rel.targetProfile || undefined,
    }));
  } else {
    // Join with both source and target profiles
    const relationships = await db
      .select({
        id: profileRelationships.id,
        relationshipType: profileRelationships.relationshipType,
        pending: profileRelationships.pending,
        createdAt: profileRelationships.createdAt,
        sourceProfileId: profileRelationships.sourceProfileId,
        targetProfileId: profileRelationships.targetProfileId,
        sourceProfile: {
          id: sourceProfiles.id,
          name: sourceProfiles.name,
          slug: sourceProfiles.slug,
          bio: sourceProfiles.bio,
          avatarImage: sourceProfiles.avatarImageId,
          type: sourceProfiles.type,
        },
        targetProfile: {
          id: targetProfiles.id,
          name: targetProfiles.name,
          slug: targetProfiles.slug,
          bio: targetProfiles.bio,
          avatarImage: targetProfiles.avatarImageId,
          type: targetProfiles.type,
        },
      })
      .from(profileRelationships)
      .leftJoin(sourceProfiles, eq(profileRelationships.sourceProfileId, sourceProfiles.id))
      .leftJoin(targetProfiles, eq(profileRelationships.targetProfileId, targetProfiles.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return relationships.map((rel) => ({
      relationshipType: rel.relationshipType,
      pending: rel.pending,
      createdAt: rel.createdAt,
      sourceProfile: rel.sourceProfile || undefined,
      targetProfile: rel.targetProfile || undefined,
    }));
  }
};
