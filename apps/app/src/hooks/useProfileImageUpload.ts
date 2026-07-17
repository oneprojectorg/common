'use client';

import { useSignedImageUpload } from '@/hooks/useSignedImageUpload';
import { trpc } from '@op/api/client';

/**
 * Signed-URL upload for an existing profile's avatar or banner (personal
 * profiles and org profiles share the endpoints; access is asserted
 * server-side). Persists immediately via `profile.saveProfileImage` — for
 * uploads whose target profile doesn't exist yet (create-org flows), use
 * `useSignedImageUpload` with `profile.signDraftProfileImageUploadUrl`
 * instead.
 */
export function useProfileImageUpload({
  profileId,
  imageType,
  initialUrl,
  onSuccess,
}: {
  /** Target profile; may be briefly undefined while the account query loads. */
  profileId: string | undefined;
  imageType: 'avatar' | 'banner';
  initialUrl?: string;
  onSuccess?: () => void;
}) {
  const signMutation = trpc.profile.signProfileImageUploadUrl.useMutation();
  const saveMutation = trpc.profile.saveProfileImage.useMutation();

  return useSignedImageUpload({
    sign: (fileName) => {
      if (!profileId) {
        throw new Error('Profile is not ready yet');
      }
      return signMutation.mutateAsync({ profileId, imageType, fileName });
    },
    record: ({ storagePath, mimeType }) => {
      if (!profileId) {
        throw new Error('Profile is not ready yet');
      }
      return saveMutation.mutateAsync({
        profileId,
        imageType,
        storagePath,
        mimeType,
      });
    },
    initialUrl,
    onSuccess,
  });
}
