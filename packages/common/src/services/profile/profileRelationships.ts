import { and, db, eq } from '@op/db/client';
import { profileRelationships, profiles } from '@op/db/schema';

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
  sourceProfileId,
  includeTargetProfiles = false,
}: {
  targetProfileId?: string;
  sourceProfileId?: string;
  includeTargetProfiles?: boolean;
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
  }>
> => {
  const currentProfileId = await getCurrentProfileId();

  if (!currentProfileId) {
    throw new ValidationError('You must be logged in to view relationships');
  }

  // Determine the source profile ID
  const actualSourceProfileId = sourceProfileId ?? currentProfileId;

  // Build the where conditions
  const conditions = [
    eq(profileRelationships.sourceProfileId, actualSourceProfileId),
  ];

  if (targetProfileId) {
    conditions.push(eq(profileRelationships.targetProfileId, targetProfileId));
  }

  let relationships;

  if (includeTargetProfiles) {
    relationships = await db
      .select({
        relationshipType: profileRelationships.relationshipType,
        pending: profileRelationships.pending,
        createdAt: profileRelationships.createdAt,
        targetProfile: {
          id: profiles.id,
          name: profiles.name,
          slug: profiles.slug,
          bio: profiles.bio,
          avatarImage: profiles.avatarImageId,
          type: profiles.type,
        },
      })
      .from(profileRelationships)
      .innerJoin(
        profiles,
        eq(profiles.id, profileRelationships.targetProfileId),
      )
      .where(and(...conditions));
  } else {
    relationships = await db
      .select({
        relationshipType: profileRelationships.relationshipType,
        pending: profileRelationships.pending,
        createdAt: profileRelationships.createdAt,
      })
      .from(profileRelationships)
      .where(and(...conditions));
  }

  return relationships.map((rel) => {
    const baseRel = {
      relationshipType: rel.relationshipType,
      pending: rel.pending,
      createdAt: rel.createdAt,
    };

    if ('targetProfile' in rel) {
      return {
        ...baseRel,
        targetProfile: rel.targetProfile as {
          id: string;
          name: string;
          slug: string;
          bio: string | null;
          avatarImage: string | null;
          type: string;
        },
      };
    }

    return baseRel;
  });
};
