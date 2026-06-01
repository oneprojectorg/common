import { EntityType } from '@op/db/schema';
import { permission } from 'access-zones';

import { ConflictError } from '../../utils/error';
import { assertProfileTypeAccess } from '../access';
import { resolveOrCreateDefaultCollection } from './resolveOrCreateDefaultCollection';
import { assertCollectionAccess } from './resourceAuth';

export const resolveTargetCollection = async ({
  authUserId,
  scope,
}: {
  authUserId: string;
  scope: { profileId?: string; collectionId?: string };
}): Promise<{ collectionId: string; profileId: string }> => {
  if (scope.collectionId !== undefined) {
    const { parentProfileId } = await assertCollectionAccess({
      user: { id: authUserId },
      collectionId: scope.collectionId,
      policies: {
        [EntityType.DECISION]: { decisions: permission.ADMIN },
      },
    });
    return { collectionId: scope.collectionId, profileId: parentProfileId };
  }

  if (scope.profileId === undefined) {
    throw new ConflictError(
      'resolveTargetCollection requires profileId or collectionId',
    );
  }

  await assertProfileTypeAccess({
    user: { id: authUserId },
    profileIds: [scope.profileId],
    policies: {
      [EntityType.DECISION]: { decisions: permission.ADMIN },
    },
  });

  const collection = await resolveOrCreateDefaultCollection({
    profileId: scope.profileId,
    createIfMissing: true,
  });
  if (!collection) {
    throw new ConflictError('Failed to resolve collection');
  }
  return { collectionId: collection.id, profileId: scope.profileId };
};
