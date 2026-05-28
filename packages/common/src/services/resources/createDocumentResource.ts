import { db } from '@op/db/client';
import { attachments, objectsInStorage, resources } from '@op/db/schema';
import { and, eq } from 'drizzle-orm';

import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../utils/error';
import { getStorageObjectSize } from '../../utils/storage';
import { getIndividualProfileId } from '../access';
import { STORAGE_BUCKET, resourcePathPrefix } from './constants';
import { insertAtTop } from './ordering';
import { getResourceInCollection } from './resourceQueries';
import { resolveTargetCollection } from './targetCollection';
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
};

export const createDocumentResource = async (
  input: CreateDocumentInput,
): Promise<ResourceInCollectionDTO> => {
  const [{ collectionId, profileId }, addedByProfileId, storageObjectRows] =
    await Promise.all([
      resolveTargetCollection({
        authUserId: input.authUserId,
        scope: {
          profileId: input.profileId,
          collectionId: input.collectionId,
        },
      }),
      getIndividualProfileId(input.authUserId),
      // Resolve the storage object the client just uploaded into via the
      // signed URL. We look it up by (bucket, name) because the client only
      // knows the path it received from sign-upload — not the object UUID.
      db
        .select({
          id: objectsInStorage.id,
          metadata: objectsInStorage.metadata,
        })
        .from(objectsInStorage)
        .where(
          and(
            eq(objectsInStorage.bucketId, STORAGE_BUCKET),
            eq(objectsInStorage.name, input.storagePath),
          ),
        )
        .limit(1),
    ]);
  const storageObject = storageObjectRows[0];

  if (!storageObject) {
    throw new NotFoundError('Storage object', input.storagePath);
  }
  // The signed URL is path-scoped, but the client supplies the path back to
  // us here — reject anything outside this profile's resources/ prefix.
  if (!input.storagePath.startsWith(resourcePathPrefix(profileId))) {
    throw new ValidationError('Storage object does not belong to this profile');
  }

  const fileSize = getStorageObjectSize(storageObject.metadata);

  const { resourceId, sortKey } = await db.transaction(async (tx) => {
    const [attachment] = await tx
      .insert(attachments)
      .values({
        storageObjectId: storageObject.id,
        fileName: input.fileName,
        mimeType: input.mimeType,
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

    const sortKey = await insertAtTop({
      tx,
      collectionId,
      resourceId: row.id,
      addedByProfileId,
    });
    return { resourceId: row.id, sortKey };
  });

  return getResourceInCollection({ resourceId, collectionId, sortKey });
};
