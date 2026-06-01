import { db } from '@op/db/client';
import { attachments, objectsInStorage, resources } from '@op/db/schema';
import { and, eq } from 'drizzle-orm';

import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../utils/error';
import {
  getStorageObjectMimeType,
  getStorageObjectSize,
} from '../../utils/storage';
import { getIndividualProfileId } from '../access';
import {
  MAX_RESOURCE_FILE_SIZE,
  STORAGE_BUCKET,
  isAllowedResourceMimeType,
  resourcePathPrefix,
} from './constants';
import { getResourceById } from './getResourceById';
import { insertResourceAtTop } from './ordering';
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
};

export const createDocumentResource = async (
  input: CreateDocumentInput,
): Promise<ResourceInCollectionDTO> => {
  const [{ collectionId, profileId }, addedByProfileId, [storageObject]] =
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

  if (!storageObject) {
    throw new NotFoundError('Storage object', input.storagePath);
  }
  // The signed URL is path-scoped, but the client supplies the path back to
  // us here — reject anything outside this profile's resources/ prefix.
  if (!input.storagePath.startsWith(resourcePathPrefix(profileId))) {
    throw new ValidationError('Storage object does not belong to this profile');
  }

  const fileSize = getStorageObjectSize(storageObject.metadata);
  if (fileSize !== null && fileSize > MAX_RESOURCE_FILE_SIZE) {
    throw new ValidationError('File exceeds the maximum allowed size');
  }

  // The router constrains the *declared* mimeType to the allowlist, but the
  // client controls the bytes it uploaded via the signed URL. Cross-check the
  // declared type against the content-type Supabase recorded for the object
  // so a caller can't upload arbitrary bytes under an allowed label. When the
  // metadata has no mimetype we can't verify, so we fall back to the declared
  // (already-allowlisted) value rather than reject a legitimate upload.
  const actualMimeType = getStorageObjectMimeType(storageObject.metadata);
  if (
    actualMimeType !== null &&
    (actualMimeType !== input.mimeType ||
      !isAllowedResourceMimeType(actualMimeType))
  ) {
    throw new ValidationError(
      'Uploaded file content does not match the declared file type',
    );
  }

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
