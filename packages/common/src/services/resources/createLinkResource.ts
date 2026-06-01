import { db } from '@op/db/client';
import { resources } from '@op/db/schema';

import { ConflictError } from '../../utils/error';
import { getIndividualProfileId } from '../access';
import { getResourceById } from './getResourceById';
import { insertResourceAtTop } from './ordering';
import { resolveTargetCollection } from './resolveTargetCollection';
import { type ResourceInCollectionDTO } from './types';

export type CreateLinkInput = {
  authUserId: string;
  profileId?: string;
  collectionId?: string;
  title: string;
  description: string | null;
  linkUrl: string;
};

export const createLinkResource = async (
  input: CreateLinkInput,
): Promise<ResourceInCollectionDTO> => {
  const [{ collectionId }, addedByProfileId] = await Promise.all([
    resolveTargetCollection({
      authUserId: input.authUserId,
      scope: {
        profileId: input.profileId,
        collectionId: input.collectionId,
      },
    }),
    getIndividualProfileId(input.authUserId),
  ]);

  const { resourceId, sortKey } = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(resources)
      .values({
        title: input.title,
        description: input.description,
        linkUrl: input.linkUrl,
        addedByProfileId,
      })
      .returning();
    if (!row) {
      throw new ConflictError('Failed to create resource');
    }
    const resourceItem = await insertResourceAtTop({
      tx,
      collectionId,
      resourceId: row.id,
      addedByProfileId,
    });
    return { resourceId: row.id, sortKey: resourceItem.sortKey };
  });

  const base = await getResourceById({ id: resourceId });
  return { ...base, collectionId, sortKey };
};
