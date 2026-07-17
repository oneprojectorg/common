import type { User } from '@op/supabase/lib';

import { NotFoundError, ValidationError } from '../../utils';
import {
  IMAGE_UPLOAD_SIZE_LIMIT,
  getStorageObjectMimeType,
  getStorageObjectSize,
  isAllowedUploadMimeType,
} from '../../utils/storage';
import { getStorageObjectByPath } from '../../utils/storageObject';
import { draftProfileImagePathPrefix } from './signDraftProfileImageUploadUrl';

/**
 * Server-side trust-boundary check on a draft profile image the client
 * uploaded via {@link signDraftProfileImageUploadUrl} and passed back by
 * path: the object must exist, live in the caller's own draft prefix, and be
 * an allowlisted image within the size cap (all checked against the
 * Supabase-recorded metadata, never client claims). Returns the storage
 * object id for the caller to persist into a profile image column.
 */
export async function claimDraftProfileImage({
  storagePath,
  user,
}: {
  storagePath: string;
  user: User;
}): Promise<string> {
  const storageObject = await getStorageObjectByPath({ path: storagePath });
  if (!storageObject) {
    throw new NotFoundError('Storage object', storagePath);
  }
  if (!storagePath.startsWith(draftProfileImagePathPrefix(user.id))) {
    throw new ValidationError('Storage object does not belong to this user');
  }
  const storedMimeType = getStorageObjectMimeType(storageObject.metadata);
  if (
    !storedMimeType ||
    !isAllowedUploadMimeType(storedMimeType) ||
    !storedMimeType.startsWith('image/')
  ) {
    throw new ValidationError('Uploaded file must be an image');
  }
  const fileSize = getStorageObjectSize(storageObject.metadata);
  if (fileSize === null || fileSize > IMAGE_UPLOAD_SIZE_LIMIT) {
    throw new ValidationError('Uploaded file exceeds the size limit');
  }
  return storageObject.id;
}
