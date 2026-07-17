import type { User } from '@op/supabase/lib';

import { signStorageUploadUrl } from '../../utils/signStorageUploadUrl';

export type ProfileImageType = 'avatar' | 'banner';

/**
 * Storage path prefix for a user's own profile images. Scoped per user and
 * per image type so `saveProfileImage` can verify a client-supplied path
 * belongs to the caller.
 */
export const profileImagePathPrefix = (
  userId: string,
  imageType: ProfileImageType,
): string => `${userId}/${imageType}/`;

export interface SignProfileImageUploadUrlInput {
  fileName: string;
  imageType: ProfileImageType;
}

export interface SignProfileImageUploadUrlResult {
  storagePath: string;
  signedUrl: string;
  token: string;
}

/**
 * Issues a Supabase signed upload URL for the caller's own profile avatar or
 * banner. The client PUTs the file binary straight to storage, then calls
 * `saveProfileImage` to validate + persist the path — the same signed-URL
 * flow the decision hero image uses, so photos never round-trip through the
 * tRPC body (which Vercel caps at ~4.5MB).
 */
export async function signProfileImageUploadUrl({
  input,
  user,
}: {
  input: SignProfileImageUploadUrlInput;
  user: User;
}): Promise<SignProfileImageUploadUrlResult> {
  return signStorageUploadUrl({
    pathPrefix: profileImagePathPrefix(user.id, input.imageType),
    fileName: input.fileName,
  });
}
