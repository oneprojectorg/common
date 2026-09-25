import { db } from '@op/db/client';
import {
  EntityType,
  attachments,
  resourceCollectionItems,
  resources,
} from '@op/db/schema';
import { permission } from 'access-zones';
import { and, eq } from 'drizzle-orm';

import { NotFoundError } from '../../utils/error';
import { lockCollection } from './ordering';
import { assertCollectionAccess } from './resourceAuth';
import { deleteResourceObject } from './storage';

export const detachResourceFromCollection = async ({
  authUserId,
  resourceId,
  collectionId,
}: {
  authUserId: string;
  resourceId: string;
  collectionId: string;
}): Promise<void> => {
  const [existing] = await Promise.all([
    db.query.resources.findFirst({
      where: { id: resourceId },
      with: { attachment: { with: { storageObject: true } } },
    }),
    assertCollectionAccess({
      user: { id: authUserId },
      collectionId,
      policies: {
        [EntityType.DECISION]: { decisions: permission.ADMIN },
      },
    }),
  ]);
  if (!existing) {
    throw new NotFoundError('Resource', resourceId);
  }

  const orphanedStorageObjectName = await db.transaction(async (tx) => {
    await lockCollection({ tx, collectionId });
    await tx
      .delete(resourceCollectionItems)
      .where(
        and(
          eq(resourceCollectionItems.collectionId, collectionId),
          eq(resourceCollectionItems.resourceId, resourceId),
        ),
      );

    // If this was the last membership, the resource has no home — cascade so
    // we don't leave a row no one can reach.
    const [remaining] = await tx
      .select({ id: resourceCollectionItems.id })
      .from(resourceCollectionItems)
      .where(eq(resourceCollectionItems.resourceId, resourceId))
      .limit(1);

    let storageObjectName: string | null = null;
    if (!remaining) {
      await tx.delete(resources).where(eq(resources.id, resourceId));
      if (existing.attachmentId) {
        await tx
          .delete(attachments)
          .where(eq(attachments.id, existing.attachmentId));
      }
      storageObjectName = existing.attachment?.storageObject?.name ?? null;
    }

    return storageObjectName;
  });

  if (orphanedStorageObjectName) {
    await deleteResourceObject(orphanedStorageObjectName);
  }
};
