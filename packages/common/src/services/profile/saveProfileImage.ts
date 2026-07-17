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
  assertProfileImageAccess,
  profileImagePathPrefix,
} from './signProfileImageUploadUrl';

export interface SaveProfileImageInput {
  profileId: string;
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
 * a signed URL (see {@link signProfileImageUploadUrl}). Re-asserts access,
 * runs the shared storage trust-boundary check (profile-scoped path prefix,
 * stored Content-Type on the allowlist matching the declared type, size cap),
 * requires the object to be an image, then points the profile's image column
 * at the new object — mirroring onto the users row when the target is the
 * caller's personal profile avatar.
 */
export async function saveProfileImage({
  input,
  user,
}: {
  input: SaveProfileImageInput;
  user: User;
}): Promise<SaveProfileImageResult> {
  const { profileId, storagePath, mimeType, imageType } = input;

  const { isPersonalProfile } = await assertProfileImageAccess({
    user,
    profileId,
  });

  const storageObject = await getStorageObjectByPath({ path: storagePath });
  const { storageObjectId, storedMimeType } = assertUploadedStorageObject({
    storageObject,
    storagePath,
    requiredPathPrefix: profileImagePathPrefix(profileId, imageType),
    declaredMimeType: mimeType,
    maxFileSize: IMAGE_UPLOAD_SIZE_LIMIT,
  });
  // The shared allowlist also permits PDFs / office docs; profile images are
  // image-only, so reject anything that isn't an image.
  if (!storedMimeType.startsWith('image/')) {
    throw new ValidationError('Profile image must be an image file');
  }

  const existingProfile = await db.query.profiles.findFirst({
    where: { id: profileId },
    columns: { avatarImageId: true, headerImageId: true },
  });
  if (!existingProfile) {
    throw new NotFoundError('Profile', profileId);
  }
  const hadPreviousImage = !!(imageType === 'avatar'
    ? existingProfile.avatarImageId
    : existingProfile.headerImageId);

  // The personal-profile avatar also lives on the users row; keep the two
  // writes consistent on failure.
  await db.transaction(async (tx) => {
    await tx
      .update(profiles)
      .set(
        imageType === 'avatar'
          ? { avatarImageId: storageObjectId }
          : { headerImageId: storageObjectId },
      )
      .where(eq(profiles.id, profileId));
    if (isPersonalProfile && imageType === 'avatar') {
      await tx
        .update(users)
        .set({ avatarImageId: storageObjectId })
        .where(eq(users.authUserId, user.id));
    }
  });

  return { storagePath, hadPreviousImage };
}
