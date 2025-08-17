import { and, db, eq } from '@op/db/client';
import { ProfileRelationshipType, profileRelationships } from '@op/db/schema';

import { ValidationError } from '../../utils/error';
import { getCurrentProfileId } from '../access';

export const addRelationship = async ({
  targetProfileId,
  relationshipType,
  pending = false,
}: {
  targetProfileId: string;
  relationshipType: string;
  pending?: boolean;
}): Promise<void> => {
  const currentProfileId = await getCurrentProfileId();

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
}: {
  targetProfileId: string;
  relationshipType: string;
}): Promise<void> => {
  const currentProfileId = await getCurrentProfileId();

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
}: {
  targetProfileId: string;
}): Promise<
  Array<{
    relationshipType: string;
    pending: boolean | null;
    createdAt: string | null;
  }>
> => {
  const currentProfileId = await getCurrentProfileId();

  if (!currentProfileId) {
    throw new ValidationError('You must be logged in to view relationships');
  }

  // Get all relationships with the target profile
  const relationships = await db
    .select({
      relationshipType: profileRelationships.relationshipType,
      pending: profileRelationships.pending,
      createdAt: profileRelationships.createdAt,
    })
    .from(profileRelationships)
    .where(
      and(
        eq(profileRelationships.sourceProfileId, currentProfileId),
        eq(profileRelationships.targetProfileId, targetProfileId),
      ),
    );

  return relationships.map((rel) => ({
    relationshipType: rel.relationshipType,
    pending: rel.pending,
    createdAt: rel.createdAt,
  }));
};

// Convenience functions for following
export const followProfile = async ({
  targetProfileId,
}: {
  targetProfileId: string;
}): Promise<void> => {
  await addRelationship({
    targetProfileId,
    relationshipType: ProfileRelationshipType.FOLLOWING,
    pending: false,
  });
};

export const unfollowProfile = async ({
  targetProfileId,
}: {
  targetProfileId: string;
}): Promise<void> => {
  await removeRelationship({
    targetProfileId,
    relationshipType: ProfileRelationshipType.FOLLOWING,
  });
};

export const isFollowing = async ({
  targetProfileId,
}: {
  targetProfileId: string;
}): Promise<boolean> => {
  const relationships = await getRelationships({ targetProfileId });
  return relationships.some(
    (rel) => rel.relationshipType === ProfileRelationshipType.FOLLOWING,
  );
};
