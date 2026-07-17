import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { signStorageUploadUrl } from '../../utils/signStorageUploadUrl';
import { assertProfileAccess } from '../assert';

export type ProfileImageType = 'avatar' | 'banner';

/**
 * Storage path prefix for a profile's images. Scoped per profile and per
 * image type so `saveProfileImage` can verify a client-supplied path belongs
 * to a profile the caller may edit.
 */
export const profileImagePathPrefix = (
  profileId: string,
  imageType: ProfileImageType,
): string => `profiles/${profileId}/${imageType}/`;

/**
 * Asserts the caller may change images on `profileId`: allowed for their own
 * personal profile, otherwise requires profile UPDATE access (e.g. org
 * admins). Returns whether the target is the caller's personal profile so
 * `saveProfileImage` knows to mirror the avatar onto the users row.
 */
export async function assertProfileImageAccess({
  user,
  profileId,
}: {
  user: User;
  profileId: string;
}): Promise<{ isPersonalProfile: boolean }> {
  const caller = await db.query.users.findFirst({
    where: { authUserId: user.id },
    columns: { profileId: true },
  });
  if (caller?.profileId === profileId) {
    return { isPersonalProfile: true };
  }
  await assertProfileAccess({
    user: { id: user.id },
    profileId,
    permissions: { profile: permission.UPDATE },
  });
  return { isPersonalProfile: false };
}

export interface SignProfileImageUploadUrlInput {
  profileId: string;
  fileName: string;
  imageType: ProfileImageType;
}

export interface SignProfileImageUploadUrlResult {
  storagePath: string;
  signedUrl: string;
  token: string;
}

/**
 * Issues a Supabase signed upload URL for a profile's avatar or banner
 * (personal profiles and org profiles share this — both hang images off a
 * profiles row). The client PUTs the file binary straight to storage, then
 * calls `saveProfileImage` to validate + persist the path — the same
 * signed-URL flow the decision hero image uses, so photos never round-trip
 * through the tRPC body (which Vercel caps at ~4.5MB).
 */
export async function signProfileImageUploadUrl({
  input,
  user,
}: {
  input: SignProfileImageUploadUrlInput;
  user: User;
}): Promise<SignProfileImageUploadUrlResult> {
  await assertProfileImageAccess({ user, profileId: input.profileId });

  return signStorageUploadUrl({
    pathPrefix: profileImagePathPrefix(input.profileId, input.imageType),
    fileName: input.fileName,
  });
}
