import { db } from '@op/db/client';
import { attachments, resources } from '@op/db/schema';

import { ConflictError } from '../../utils/error';
import {
  ASSETS_BUCKET,
  assertUploadedStorageObject,
} from '../../utils/storage';
import { getStorageObjectByPath } from '../../utils/storageObject';
import { getIndividualProfileId } from '../access';
import { MAX_RESOURCE_FILE_SIZE, resourcePathPrefix } from './constants';
import { getResourceById } from './getResourceById';
import { insertResourceAt } from './ordering';
import { resolveTargetCollection } from './resolveTargetCollection';
import { type ResourceInCollectionDTO } from './types';

export type CreateDocumentInput = {
  authUserId: string;
  profileId?: string;
  collectionId?: string;
  title: string;
  description: string | null;
  storagePath: string;
  fileName: string;
  mimeType: string;
  // When provided (including null), the new resource is inserted directly below
  // this collection member (null = top) instead of at the top. Drives drop-at-a
  // -specific-sort-point; the Add Resource form omits it and lands at the top.
  upperNeighborId?: string | null;
};

export const createDocumentResource = async (
  input: CreateDocumentInput,
): Promise<ResourceInCollectionDTO> => {
  const [{ collectionId, profileId }, addedByProfileId, storageObject] =
    await Promise.all([
      resolveTargetCollection({
        authUserId: input.authUserId,
        scope: {
          profileId: input.profileId,
          collectionId: input.collectionId,
        },
      }),
      getIndividualProfileId(input.authUserId),
      getStorageObjectByPath({
        bucketId: ASSETS_BUCKET,
        path: input.storagePath,
      }),
    ]);

  const { storageObjectId, storedMimeType, fileSize } =
    assertUploadedStorageObject({
      storageObject,
      storagePath: input.storagePath,
      requiredPathPrefix: resourcePathPrefix(profileId),
      declaredMimeType: input.mimeType,
      maxFileSize: MAX_RESOURCE_FILE_SIZE,
    });

  const { resourceId, sortKey } = await db.transaction(async (tx) => {
    const [attachment] = await tx
      .insert(attachments)
      .values({
        storageObjectId,
        fileName: input.fileName,
        mimeType: storedMimeType,
        fileSize,
        profileId,
      })
      .returning();
    if (!attachment) {
      throw new ConflictError('Failed to create attachment');
    }

    const [row] = await tx
      .insert(resources)
      .values({
        title: input.title,
        description: input.description,
        attachmentId: attachment.id,
        addedByProfileId,
      })
      .returning();
    if (!row) {
      throw new ConflictError('Failed to create resource');
    }

    // `upperNeighborId: null` (the Add Resource form's default, since it omits
    // the field) inserts at the top, so a single insertResourceAt call covers
    // both the drop-at-a-slot and add-at-top cases.
    const resourceItem = await insertResourceAt({
      tx,
      collectionId,
      resourceId: row.id,
      upperNeighborId: input.upperNeighborId ?? null,
      addedByProfileId,
    });
    return { resourceId: row.id, sortKey: resourceItem.sortKey };
  });

  const base = await getResourceById({ id: resourceId });
  return { ...base, collectionId, sortKey };
};
