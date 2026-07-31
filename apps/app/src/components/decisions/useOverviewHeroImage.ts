'use client';

import { getPublicUrl } from '@/utils';
import { trpc } from '@op/api/client';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  IMAGE_UPLOAD_SIZE_LIMIT,
  isAllowedUploadMimeType,
} from '@op/common/client';
import { toast } from '@op/sense/Toast';
import { useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

// Human-readable list of accepted types for error copy, derived from the
// shared allowlist (image subset) so it can't drift from what's enforced.
const ACCEPTED_IMAGE_LABEL = ALLOWED_UPLOAD_MIME_TYPES.filter((type) =>
  type.startsWith('image/'),
)
  .map((type) => type.split('/')[1]?.toUpperCase())
  .join(', ');

// Storage paths look like `${instanceId}/overview/${uuid}_${name}`. Recover the
// original display name (basename minus the UUID prefix signStorageUploadUrl
// prepends).
const fileNameFromPath = (path?: string): string | undefined => {
  if (!path) {
    return undefined;
  }
  const base = path.split('/').pop() ?? path;
  return base.replace(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i,
    '',
  );
};

const formatFileSize = (bytes: number): string => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

/**
 * Shared upload/remove logic for the decision overview hero image. Used by the
 * Process Builder Overview tab and the live overview's "Edit banner" modal.
 *
 * Uploads use the signed-URL flow (sign → PUT the file binary straight to
 * storage → record the path), so large photos never round-trip through the
 * tRPC body. The record step persists the storage path into
 * `instanceData.overview.heroImage`; `onChange` lets the live page refresh its
 * RSC-fed hero after a change.
 */
export function useOverviewHeroImage({
  instanceId,
  initialPath,
  onChange,
}: {
  instanceId: string;
  initialPath?: string;
  onChange?: () => void;
}) {
  const t = useTranslations();
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(
    getPublicUrl(initialPath),
  );
  const [fileName, setFileName] = useState<string | undefined>(
    fileNameFromPath(initialPath),
  );
  // Size is only known for files chosen this session — not recoverable from a
  // stored path on reload.
  const [fileSizeLabel, setFileSizeLabel] = useState<string | undefined>();
  const [isUploading, setIsUploading] = useState(false);
  // Monotonic id of the latest upload/remove. Async completions check it and
  // bail if a newer request superseded them, so a slow upload landing after a
  // remove (or after a second upload) can't revert the preview to a stale
  // image or clobber `isUploading`.
  const latestRequestRef = useRef(0);
  const signMutation =
    trpc.decision.signOverviewHeroImageUploadUrl.useMutation();
  const recordMutation = trpc.decision.updateOverviewHeroImage.useMutation();
  const removeMutation = trpc.decision.removeOverviewHeroImage.useMutation();

  const upload = async (file: File) => {
    if (
      !isAllowedUploadMimeType(file.type) ||
      !file.type.startsWith('image/')
    ) {
      toast.error(
        t('That file type is not supported. Accepted types: {types}', {
          types: ACCEPTED_IMAGE_LABEL,
        }),
      );
      return;
    }
    if (file.size > IMAGE_UPLOAD_SIZE_LIMIT) {
      toast.error(
        t('File too large. Maximum size: {size}MB', {
          size: Math.floor(IMAGE_UPLOAD_SIZE_LIMIT / 1024 / 1024),
        }),
      );
      return;
    }

    const requestId = ++latestRequestRef.current;
    // Optimistic local preview (object URL) while sign → PUT → record runs.
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setFileName(file.name);
    setFileSizeLabel(formatFileSize(file.size));
    setIsUploading(true);
    try {
      const signed = await signMutation.mutateAsync({
        instanceId,
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
      await recordMutation.mutateAsync({
        instanceId,
        storagePath: signed.storagePath,
        mimeType: file.type,
      });
      // A newer upload/remove superseded this one — don't touch shared state.
      if (latestRequestRef.current !== requestId) {
        return;
      }
      setPreviewUrl(getPublicUrl(signed.storagePath));
      setFileName(fileNameFromPath(signed.storagePath));
      onChange?.();
    } catch {
      if (latestRequestRef.current === requestId) {
        toast.error(t('Something went wrong'));
        setPreviewUrl(getPublicUrl(initialPath));
        setFileName(fileNameFromPath(initialPath));
        setFileSizeLabel(undefined);
      }
    } finally {
      if (latestRequestRef.current === requestId) {
        setIsUploading(false);
      }
      URL.revokeObjectURL(objectUrl);
    }
  };

  const remove = async () => {
    const requestId = ++latestRequestRef.current;
    try {
      await removeMutation.mutateAsync({ instanceId });
      if (latestRequestRef.current !== requestId) {
        return;
      }
      setPreviewUrl(undefined);
      setFileName(undefined);
      setFileSizeLabel(undefined);
      onChange?.();
    } catch {
      if (latestRequestRef.current === requestId) {
        toast.error(t('Something went wrong'));
      }
    }
  };

  return {
    previewUrl,
    fileName,
    fileSizeLabel,
    upload,
    remove,
    isUploading,
    isRemoving: removeMutation.isPending,
    uploadError:
      signMutation.error?.message ?? recordMutation.error?.message ?? undefined,
  };
}
