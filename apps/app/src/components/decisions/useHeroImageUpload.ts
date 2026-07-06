'use client';

import { getPublicUrl } from '@/utils';
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

// Storage paths look like `${scope}/${uuid}_${name}`. Recover the original
// display name (basename minus the UUID prefix signStorageUploadUrl prepends).
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

export interface HeroImageUploadCallbacks {
  /** Mint a signed upload URL for the given file name. */
  sign: (
    fileName: string,
  ) => Promise<{ storagePath: string; signedUrl: string }>;
  /** Persist the uploaded object's path after the PUT succeeds. */
  record: (args: { storagePath: string; mimeType: string }) => Promise<unknown>;
  /** Clear the stored image. */
  remove: () => Promise<unknown>;
  /** Whether the remove mutation is in flight. */
  isRemoving: boolean;
  /** Surfaced sign/record error, if any. */
  uploadError?: string;
}

/**
 * Shared upload/remove orchestration for a hero/banner image (overview hero,
 * phase hero, ...). Endpoint-agnostic: callers pass the signed-URL flow steps
 * (`sign` → PUT → `record`) and a `remove`, wired to whichever tRPC mutations
 * own that scope. Owns the optimistic preview, client-side MIME/size guards,
 * and the request-versioning that keeps a slow completion from clobbering a
 * newer upload/remove.
 */
export function useHeroImageUpload({
  initialPath,
  onChange,
  sign,
  record,
  remove: removeStored,
  isRemoving,
  uploadError,
}: {
  initialPath?: string;
  onChange?: () => void;
} & HeroImageUploadCallbacks) {
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
  // Last successfully persisted path (starts at the mount-time value). A failed
  // upload reverts the preview to this, not `initialPath`, so a failure after a
  // prior successful upload doesn't misrepresent what's stored.
  const committedPathRef = useRef<string | undefined>(initialPath);

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
    setPreviewUrl(objectUrl);
    setFileName(file.name);
    setFileSizeLabel(formatFileSize(file.size));
    setIsUploading(true);
    try {
      const signed = await sign(file.name);
      const putRes = await fetch(signed.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error('Upload failed');
      }
      await record({ storagePath: signed.storagePath, mimeType: file.type });
      // A newer upload/remove superseded this one — don't touch shared state.
      if (latestRequestRef.current !== requestId) {
        return;
      }
      committedPathRef.current = signed.storagePath;
      setPreviewUrl(getPublicUrl(signed.storagePath));
      setFileName(fileNameFromPath(signed.storagePath));
      onChange?.();
    } catch {
      if (latestRequestRef.current === requestId) {
        toast.error({ message: t('Something went wrong') });
        setPreviewUrl(getPublicUrl(committedPathRef.current));
        setFileName(fileNameFromPath(committedPathRef.current));
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
      await removeStored();
      if (latestRequestRef.current !== requestId) {
        return;
      }
      committedPathRef.current = undefined;
      setPreviewUrl(undefined);
      setFileName(undefined);
      setFileSizeLabel(undefined);
      onChange?.();
    } catch {
      if (latestRequestRef.current === requestId) {
        toast.error({ message: t('Something went wrong') });
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
    isRemoving,
    uploadError,
  };
}
