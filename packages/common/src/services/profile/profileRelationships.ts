import { and, db, eq } from '@op/db/client';
import {
  objectsInStorage,
  profileRelationships,
  profiles,
} from '@op/db/schema';
import { alias } from 'drizzle-orm/pg-core';

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
      avatarImage: { id: string; name: string | null } | null;
      type: string;
    };
    sourceProfile?: {
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

  // Use aliases to distinguish between source and target profiles
  const sourceProfiles = alias(profiles, 'sourceProfiles');
  const targetProfiles = alias(profiles, 'targetProfiles');
  const sourceAvatarStorage = alias(objectsInStorage, 'sourceAvatarStorage');
  const targetAvatarStorage = alias(objectsInStorage, 'targetAvatarStorage');

  // Define the base query structure
  const baseQuery = db
    .select({
      id: profileRelationships.id,
      relationshipType: profileRelationships.relationshipType,
      pending: profileRelationships.pending,
      createdAt: profileRelationships.createdAt,
      sourceProfileId: profileRelationships.sourceProfileId,
      targetProfileId: profileRelationships.targetProfileId,
      // Source profile fields
      sourceProfileId2: sourceProfiles.id,
      sourceProfileName: sourceProfiles.name,
      sourceProfileSlug: sourceProfiles.slug,
      sourceProfileBio: sourceProfiles.bio,
      sourceProfileType: sourceProfiles.type,
      sourceAvatarId: sourceAvatarStorage.id,
      sourceAvatarName: sourceAvatarStorage.name,
      // Target profile fields
      targetProfileId2: targetProfiles.id,
      targetProfileName: targetProfiles.name,
      targetProfileSlug: targetProfiles.slug,
      targetProfileBio: targetProfiles.bio,
      targetProfileType: targetProfiles.type,
      targetAvatarId: targetAvatarStorage.id,
      targetAvatarName: targetAvatarStorage.name,
    })
    .from(profileRelationships)
    .leftJoin(
      sourceProfiles,
      eq(profileRelationships.sourceProfileId, sourceProfiles.id),
    )
    .leftJoin(
      targetProfiles,
      eq(profileRelationships.targetProfileId, targetProfiles.id),
    )
    .leftJoin(
      sourceAvatarStorage,
      eq(sourceProfiles.avatarImageId, sourceAvatarStorage.id),
    )
    .leftJoin(
      targetAvatarStorage,
      eq(targetProfiles.avatarImageId, targetAvatarStorage.id),
    );

  // Declaratively define all possible conditions
  const conditions = [];

  conditions.push(
    eq(
      profileRelationships.sourceProfileId,
      sourceProfileId ?? currentProfileId,
    ),
  );

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

  if (profileType) {
    conditions.push(eq(targetProfiles.type, profileType));
  }

  // Execute the query with all applicable conditions
  const relationships = await baseQuery.where(
    conditions.length > 0 ? and(...conditions) : undefined,
  );

  // Transform the results to match the expected return type
  return relationships.map((rel) => ({
    relationshipType: rel.relationshipType as string,
    pending: rel.pending as boolean | null,
    createdAt: rel.createdAt as string | null,
    sourceProfile: rel.sourceProfileId2
      ? {
          id: rel.sourceProfileId2 as string,
          name: rel.sourceProfileName as string,
          slug: rel.sourceProfileSlug as string,
          bio: rel.sourceProfileBio as string | null,
          avatarImage: rel.sourceAvatarId
            ? {
                id: rel.sourceAvatarId as string,
                name: rel.sourceAvatarName as string | null,
              }
            : null,
          type: rel.sourceProfileType as string,
        }
      : undefined,
    targetProfile: rel.targetProfileId2
      ? {
          id: rel.targetProfileId2 as string,
          name: rel.targetProfileName as string,
          slug: rel.targetProfileSlug as string,
          bio: rel.targetProfileBio as string | null,
          avatarImage: rel.targetAvatarId
            ? {
                id: rel.targetAvatarId as string,
                name: rel.targetAvatarName as string | null,
              }
            : null,
          type: rel.targetProfileType as string,
        }
      : undefined,
  }));
};
