import { db, eq } from '@op/db/client';
import { profiles, users } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError, ValidationError } from '../../utils';
import {
  IMAGE_UPLOAD_SIZE_LIMIT,
  assertUploadedStorageObject,
} from '../../utils/storage';
import { getStorageObjectByPath } from '../../utils/storageObject';
import {
  type ProfileImageType,
  profileImagePathPrefix,
} from './signProfileImageUploadUrl';

export interface SaveProfileImageInput {
  /** Path of the storage object the client just uploaded into. */
  storagePath: string;
  /** Client-declared MIME type; must match what storage recorded on PUT. */
  mimeType: string;
  imageType: ProfileImageType;
}

export interface SaveProfileImageResult {
  storagePath: string;
  hadPreviousImage: boolean;
}

/**
 * Records a profile avatar/banner the client uploaded directly to storage via
 * a signed URL (see {@link signProfileImageUploadUrl}). Runs the shared
 * storage trust-boundary check (caller's own path prefix, stored Content-Type
 * on the allowlist matching the declared type, size cap), requires the object
 * to be an image, then points the user's — and their personal profile's —
 * image column at the new object.
 */
export async function saveProfileImage({
  input,
  user,
}: {
  input: SaveProfileImageInput;
  user: User;
}): Promise<SaveProfileImageResult> {
  const { storagePath, mimeType, imageType } = input;

  const storageObject = await getStorageObjectByPath({ path: storagePath });
  const { storageObjectId, storedMimeType } = assertUploadedStorageObject({
    storageObject,
    storagePath,
    requiredPathPrefix: profileImagePathPrefix(user.id, imageType),
    declaredMimeType: mimeType,
    maxFileSize: IMAGE_UPLOAD_SIZE_LIMIT,
  });
  // The shared allowlist also permits PDFs / office docs; profile images are
  // image-only, so reject anything that isn't an image.
  if (!storedMimeType.startsWith('image/')) {
    throw new ValidationError('Profile image must be an image file');
  }

  const existingUser = await db.query.users.findFirst({
    where: { authUserId: user.id },
    columns: { profileId: true, avatarImageId: true },
  });
  if (!existingUser) {
    throw new NotFoundError('User');
  }

  if (imageType === 'avatar') {
    const hadPreviousImage = !!existingUser.avatarImageId;
    // Two rows point at the avatar; keep them consistent on failure.
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ avatarImageId: storageObjectId })
        .where(eq(users.authUserId, user.id));
      if (existingUser.profileId) {
        await tx
          .update(profiles)
          .set({ avatarImageId: storageObjectId })
          .where(eq(profiles.id, existingUser.profileId));
      }
    });
    return { storagePath, hadPreviousImage };
  }

  if (!existingUser.profileId) {
    throw new NotFoundError('User profile');
  }
  const existingProfile = await db.query.profiles.findFirst({
    where: { id: existingUser.profileId },
    columns: { headerImageId: true },
  });
  const hadPreviousImage = !!existingProfile?.headerImageId;
  await db
    .update(profiles)
    .set({ headerImageId: storageObjectId })
    .where(eq(profiles.id, existingUser.profileId));
  return { storagePath, hadPreviousImage };
}
