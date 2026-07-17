import type { User } from '@op/supabase/lib';

import { signStorageUploadUrl } from '../../utils/signStorageUploadUrl';

/**
 * Storage path prefix for images uploaded before their target profile exists
 * (e.g. the create-organization forms upload a logo/banner, and the profile
 * row is only created on submit). Scoped per auth user so
 * `claimDraftProfileImage` can verify a client-supplied path belongs to the
 * caller. Cannot collide with `profileImagePathPrefix` — 'drafts' is not a
 * profile UUID.
 */
export const draftProfileImagePathPrefix = (authUserId: string): string =>
  `profiles/drafts/${authUserId}/`;

export interface SignDraftProfileImageUploadUrlInput {
  fileName: string;
}

export interface SignDraftProfileImageUploadUrlResult {
  storagePath: string;
  signedUrl: string;
  token: string;
}

/**
 * Issues a Supabase signed upload URL in the caller's own draft space, for
 * profile images uploaded before the target profile exists. The client PUTs
 * the file binary straight to storage and passes the returned path into the
 * mutation that creates/updates the profile (e.g. `organization.create`),
 * which validates + persists it via `claimDraftProfileImage`.
 */
export async function signDraftProfileImageUploadUrl({
  input,
  user,
}: {
  input: SignDraftProfileImageUploadUrlInput;
  user: User;
}): Promise<SignDraftProfileImageUploadUrlResult> {
  return signStorageUploadUrl({
    pathPrefix: draftProfileImagePathPrefix(user.id),
    fileName: input.fileName,
  });
}
