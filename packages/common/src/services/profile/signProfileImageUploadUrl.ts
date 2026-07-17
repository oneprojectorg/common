import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { signStorageUploadUrl } from '../../utils/signStorageUploadUrl';
import { getProfileAccessRoles } from '../access';

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
  // The roles lookup is wasted work for personal profiles, but fetching both
  // in parallel saves a serial round trip on the org-profile path.
  const [caller, roles] = await Promise.all([
    db.query.users.findFirst({
      where: { authUserId: user.id },
      columns: { profileId: true },
    }),
    getProfileAccessRoles({ user: { id: user.id }, profileId }),
  ]);
  if (caller?.profileId === profileId) {
    return { isPersonalProfile: true };
  }
  if (!checkPermission({ profile: permission.UPDATE }, roles)) {
    throw new UnauthorizedError('Not authorized');
  }
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
