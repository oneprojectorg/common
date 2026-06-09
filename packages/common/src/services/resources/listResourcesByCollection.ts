import { type AccessUser } from '../access';
import { getResourcesInCollection } from './getResourcesInCollection';
import { assertCollectionReadAccess } from './resourceAuth';
import { type ResourceListResult } from './types';

export const listResourcesByCollection = async ({
  user,
  collectionId,
  limit,
  cursor,
}: {
  user?: AccessUser;
  collectionId: string;
  limit?: number;
  cursor?: string | null;
}): Promise<ResourceListResult> => {
  // Authorize before fetching: the read fans out into per-item signed-URL
  // generation, so an unauthorized caller must not trigger that work before
  // being rejected.
  await assertCollectionReadAccess({ user, collectionId });

  return getResourcesInCollection({ collectionId, limit, cursor });
};
