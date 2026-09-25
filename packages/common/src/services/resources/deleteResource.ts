import { db } from '@op/db/client';
import { EntityType, attachments, resources } from '@op/db/schema';
import { permission } from 'access-zones';
import { eq } from 'drizzle-orm';

import { NotFoundError } from '../../utils/error';
import { assertProfileTypeAccess } from '../access';
import { getScopesForResource } from './channelScope';
import { lockCollection } from './ordering';
import { assertResourceAccess } from './resourceAuth';
import { deleteResourceObject } from './storage';

export const deleteResource = async ({
  authUserId,
  id,
}: {
  authUserId: string;
  id: string;
}): Promise<void> => {
  const policies = {
    [EntityType.DECISION]: { decisions: permission.ADMIN },
  };
  const { parentProfileIds } = await assertResourceAccess({
    user: { id: authUserId },
    resourceId: id,
    policies,
  });

  // Destructive delete cascades to every collection holding this resource.
  // Admin on a single parent profile isn't enough — otherwise admin of
  // profile A could wipe a resource that's also pinned to profile B's
  // collection. Require admin on every parent profile.
  const sortedParentIds = [...new Set(parentProfileIds)].sort();
  const [existing, { collectionIds }] = await Promise.all([
    db.query.resources.findFirst({
      where: { id },
      with: { attachment: { with: { storageObject: true } } },
    }),
    // Snapshot memberships before the TX so we can hold the same advisory
    // lock as concurrent reorder/attach on each containing collection.
    getScopesForResource(id),
    Promise.all(
      sortedParentIds.map((parentProfileId) =>
        assertProfileTypeAccess({
          user: { id: authUserId },
          profileIds: [parentProfileId],
          policies,
        }),
      ),
    ),
  ]);
  if (!existing) {
    throw new NotFoundError('Resource', id);
  }

  const storageObjectName = existing.attachment?.storageObject?.name ?? null;
  const sortedCollectionIds = [...collectionIds].sort();

  await db.transaction(async (tx) => {
    // Sorted order prevents deadlocks against attach/reorder paths.
    for (const collectionId of sortedCollectionIds) {
      await lockCollection({ tx, collectionId });
    }
    // resource_collection_items cascades on resource deletion; the resource
    // row goes first so we don't need to touch memberships explicitly.
    await tx.delete(resources).where(eq(resources.id, id));
    if (existing.attachmentId) {
      await tx
        .delete(attachments)
        .where(eq(attachments.id, existing.attachmentId));
    }
  });

  if (storageObjectName) {
    await deleteResourceObject(storageObjectName);
  }
};
