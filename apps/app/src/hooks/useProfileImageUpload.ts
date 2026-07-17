'use client';

import { getPublicUrl } from '@/utils';
import { trpc } from '@op/api/client';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  IMAGE_UPLOAD_SIZE_LIMIT,
  isAllowedUploadMimeType,
} from '@op/common/client';
import { toast } from '@op/ui/Toast';
import { useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

// Human-readable list of accepted types for error copy, derived from the
// shared allowlist (image subset) so it can't drift from what's enforced.
const ACCEPTED_IMAGE_LABEL = ALLOWED_UPLOAD_MIME_TYPES.filter((type) =>
  type.startsWith('image/'),
)
  .map((type) => type.split('/')[1]?.toUpperCase())
  .join(', ');

/**
 * Shared upload logic for the profile avatar and banner images (edit-profile
 * modal + onboarding form).
 *
 * Uploads use the signed-URL flow (sign → PUT the file binary straight to
 * storage → record the path), so the file never rides inside a tRPC request
 * body — Vercel rejects bodies over ~4.5MB, which is what broke the old
 * base64-through-tRPC flow for large photos.
 */
export function useProfileImageUpload({
  imageType,
  initialUrl,
  onSuccess,
}: {
  imageType: 'avatar' | 'banner';
  initialUrl?: string;
  onSuccess?: () => void;
}) {
  const t = useTranslations();
  const [url, setUrl] = useState<string | undefined>(initialUrl);
  const [isUploading, setIsUploading] = useState(false);
  // Monotonic id of the latest upload. Async completions check it and bail if
  // a newer request superseded them, so a slow upload landing after a second
  // upload can't revert the preview to a stale image or clobber `isUploading`.
  const latestRequestRef = useRef(0);
  const signMutation = trpc.account.signProfileImageUploadUrl.useMutation();
  const saveMutation = trpc.account.saveProfileImage.useMutation();

  const upload = async (file: File) => {
    if (
      !isAllowedUploadMimeType(file.type) ||
      !file.type.startsWith('image/')
    ) {
      toast.error({
        message: t('That file type is not supported. Accepted types: {types}', {
          types: ACCEPTED_IMAGE_LABEL,
        }),
      });
      return;
    }
    if (file.size > IMAGE_UPLOAD_SIZE_LIMIT) {
      toast.error({
        message: t('File too large. Maximum size: {size}MB', {
          size: Math.floor(IMAGE_UPLOAD_SIZE_LIMIT / 1024 / 1024),
        }),
      });
      return;
    }

    const requestId = ++latestRequestRef.current;
    // Optimistic local preview (object URL) while sign → PUT → record runs.
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    setIsUploading(true);
    try {
      const signed = await signMutation.mutateAsync({
        imageType,
        fileName: file.name,
      });
      const putRes = await fetch(signed.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error('Upload failed');
      }
      await saveMutation.mutateAsync({
        imageType,
        storagePath: signed.storagePath,
        mimeType: file.type,
      });
      // A newer upload superseded this one — don't touch shared state.
      if (latestRequestRef.current !== requestId) {
        return;
      }
      setUrl(getPublicUrl(signed.storagePath));
      onSuccess?.();
    } catch {
      if (latestRequestRef.current === requestId) {
        toast.error({ message: t('Something went wrong') });
        setUrl(initialUrl);
      }
    } finally {
      if (latestRequestRef.current === requestId) {
        setIsUploading(false);
      }
      URL.revokeObjectURL(objectUrl);
    }
  };

  return {
    url,
    upload,
    isUploading,
    uploadError:
      signMutation.error?.message ?? saveMutation.error?.message ?? undefined,
  };
}
