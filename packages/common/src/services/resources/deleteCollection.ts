import { db } from '@op/db/client';
import {
  EntityType,
  resourceCollectionProfiles,
  resourceCollections,
} from '@op/db/schema';
import { permission } from 'access-zones';
import { and, count, eq } from 'drizzle-orm';

import { lockProfile } from './ordering';
import { assertCollectionAccess } from './resourceAuth';

export const deleteCollection = async ({
  authUserId,
  id,
}: {
  authUserId: string;
  id: string;
}): Promise<{ profileIds: string[] }> => {
  const { parentProfileIds, parentProfileId: profileId } =
    await assertCollectionAccess({
      user: { id: authUserId },
      collectionId: id,
      policies: {
        [EntityType.DECISION]: { decisions: permission.ADMIN },
      },
    });

  await db.transaction(async (tx) => {
    await lockProfile({ tx, profileId });

    await tx
      .delete(resourceCollectionProfiles)
      .where(
        and(
          eq(resourceCollectionProfiles.collectionId, id),
          eq(resourceCollectionProfiles.profileId, profileId),
        ),
      );

    const [remainingRow] = await tx
      .select({ value: count() })
      .from(resourceCollectionProfiles)
      .where(eq(resourceCollectionProfiles.collectionId, id));
    const remaining = remainingRow?.value ?? 0;

    if (remaining === 0) {
      await tx
        .delete(resourceCollections)
        .where(eq(resourceCollections.id, id));
    }
  });

  return { profileIds: parentProfileIds };
};
