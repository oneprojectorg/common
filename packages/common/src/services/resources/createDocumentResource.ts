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

  // Supabase records the Content-Type sent on PUT into the object metadata,
  // and serves the file back with that same header. Trust the storage record
  // (not the user's separate `mimeType` argument), and re-check the allowlist
  // here in case the client PUT with a Content-Type we don't accept.
  const storedMimeType = getStorageObjectMimeType(storageObject.metadata);
  if (!storedMimeType || !isAllowedResourceMimeType(storedMimeType)) {
    throw new ValidationError('Uploaded file has an unsupported content type');
  }
  if (storedMimeType !== input.mimeType) {
    throw new ValidationError(
      'Declared mimeType does not match the uploaded file',
    );
  }

  // Storage object size is the only place we see the actual upload size: the
  // signed PUT URL itself has no inherent cap, and the client-side guard is
  // UX only. Reject before persisting metadata so oversized blobs don't get
  // a resource row pointing at them.
  const fileSize = getStorageObjectSize(storageObject.metadata);
  if (fileSize === null || fileSize > MAX_RESOURCE_FILE_SIZE) {
    throw new ValidationError('Uploaded file exceeds the size limit');
  }

  const { resourceId, sortKey } = await db.transaction(async (tx) => {
    const [attachment] = await tx
      .insert(attachments)
      .values({
        storageObjectId: storageObject.id,
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
