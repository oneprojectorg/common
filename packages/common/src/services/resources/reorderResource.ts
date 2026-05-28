import { db } from '@op/db/client';
import { EntityType, resourceCollectionItems } from '@op/db/schema';
import { permission } from 'access-zones';
import { eq } from 'drizzle-orm';

import { computeReorder, lockCollection } from './ordering';
import { assertCollectionAccess } from './resourceAuth';
import { getResourceInCollection } from './resourceQueries';
import { type ResourceInCollectionDTO } from './types';

export const reorderResource = async ({
  authUserId,
  resourceId,
  collectionId,
  upperNeighborId,
}: {
  authUserId: string;
  resourceId: string;
  collectionId: string;
  upperNeighborId: string | null;
}): Promise<ResourceInCollectionDTO> => {
  // Auth on the collection — reorder is a property of the membership row.
  // computeReorder below throws NotFoundError if the resource isn't in this
  // collection, so we don't need a separate resource-existence check.
  await assertCollectionAccess({
    user: { id: authUserId },
    collectionId,
    policies: {
      [EntityType.DECISION]: { decisions: permission.ADMIN },
    },
  });

  const finalSortKey = await db.transaction(async (tx) => {
    await lockCollection({ tx, collectionId });

    const plan = await computeReorder({
      tx,
      collectionId,
      itemId: resourceId,
      upperNeighborId,
    });
    if (plan.changed) {
      await tx
        .update(resourceCollectionItems)
        .set({ sortKey: plan.sortKey })
        .where(eq(resourceCollectionItems.id, plan.rowId));
    }
    return plan.sortKey;
  });

  return getResourceInCollection({
    resourceId,
    collectionId,
    sortKey: finalSortKey,
  });
};
