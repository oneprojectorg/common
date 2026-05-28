import { db } from '@op/db/client';
import { EntityType } from '@op/db/schema';
import { permission } from 'access-zones';

import { getIndividualProfileId } from '../access';
import { findCollectionItem, insertAtTop, lockCollection } from './ordering';
import { assertCollectionAccess, assertResourceAccess } from './resourceAuth';
import { getResourceInCollection } from './resourceQueries';
import { type ResourceInCollectionDTO } from './types';

export const attachResourceToCollection = async ({
  authUserId,
  resourceId,
  collectionId,
}: {
  authUserId: string;
  resourceId: string;
  collectionId: string;
}): Promise<ResourceInCollectionDTO> => {
  const policies = {
    [EntityType.DECISION]: { decisions: permission.ADMIN },
  };
  // Require admin on both endpoints: an admin of collection X can't drag
  // someone else's resource Y into X without also having admin where Y lives.
  // TODO: we may want to relax the resource side to READ once we have a
  // clearer story for shared/discoverable resources — letting any reader
  // pin a resource into their own collection. Keeping admin-on-both for now.
  const user = { id: authUserId };
  const [addedByProfileId] = await Promise.all([
    getIndividualProfileId(authUserId),
    assertCollectionAccess({ user, collectionId, policies }),
    assertResourceAccess({ user, resourceId, policies }),
  ]);

  const sortKey = await db.transaction(async (tx) => {
    // Lock before the existence probe — otherwise two concurrent attaches both
    // see "no row", both call insertAtTop, and the second trips the
    // (collection_id, resource_id) unique index as a 500.
    await lockCollection({ tx, collectionId });
    const existing = await findCollectionItem({ tx, collectionId, resourceId });
    if (existing) {
      return existing.sortKey;
    }
    return insertAtTop({ tx, collectionId, resourceId, addedByProfileId });
  });

  return getResourceInCollection({ resourceId, collectionId, sortKey });
};
