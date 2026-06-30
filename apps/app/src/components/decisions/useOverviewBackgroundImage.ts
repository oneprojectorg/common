'use client';

import { getPublicUrl } from '@/utils';
import { trpc } from '@op/api/client';
import {
  ALLOWED_BACKGROUND_IMAGE_MIME_TYPES,
  MAX_BACKGROUND_IMAGE_SIZE,
} from '@op/common/client';
import { toast } from '@op/ui/Toast';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

// Storage paths look like `${instanceId}/overview/${Date.now()}_${name}`.
// Recover the original display name (basename minus the timestamp prefix).
const fileNameFromPath = (path?: string): string | undefined => {
  if (!path) {
    return undefined;
  }
  const base = path.split('/').pop() ?? path;
  return base.replace(/^\d+_/, '');
};

const formatFileSize = (bytes: number): string => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

/**
 * Shared upload/remove logic for the decision overview hero background image.
 * Used by the Process Builder Overview tab and the live overview's "Edit
 * banner" modal. The upload mutation persists the storage path into
 * `instanceData.overview.backgroundImage`; `onChange` lets the live page
 * refresh its RSC-fed hero after a change.
 */
export function useOverviewBackgroundImage({
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
  const uploadMutation =
    trpc.decision.uploadOverviewBackgroundImage.useMutation();
  const updateInstance = trpc.decision.updateDecisionInstance.useMutation();

  const upload = (file: File) => {
    if (!ALLOWED_BACKGROUND_IMAGE_MIME_TYPES.includes(file.type)) {
      toast.error({
        message: t('That file type is not supported. Accepted types: {types}', {
          types: ALLOWED_BACKGROUND_IMAGE_MIME_TYPES.map(
            (type) => type.split('/')[1],
          ).join(', '),
        }),
      });
      return;
    }
    if (file.size > MAX_BACKGROUND_IMAGE_SIZE) {
      toast.error({
        message: t('File too large. Maximum size: {size}MB', {
          size: (MAX_BACKGROUND_IMAGE_SIZE / 1024 / 1024).toFixed(2),
        }),
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string)?.split(',')[1];
      if (!base64) {
        return;
      }
      // Optimistic preview while the upload is in flight.
      setPreviewUrl(`data:${file.type};base64,${base64}`);
      setFileName(file.name);
      setFileSizeLabel(formatFileSize(file.size));
      try {
        const res = await uploadMutation.mutateAsync({
          instanceId,
          file: base64,
          fileName: file.name,
          mimeType: file.type,
        });
        setPreviewUrl(res.url);
        onChange?.();
      } catch {
        toast.error({ message: t('Something went wrong') });
        setPreviewUrl(getPublicUrl(initialPath));
        setFileName(fileNameFromPath(initialPath));
        setFileSizeLabel(undefined);
      }
    };
    reader.readAsDataURL(file);
  };

  const remove = async () => {
    try {
      await updateInstance.mutateAsync({
        instanceId,
        overview: { backgroundImage: '' },
      });
      setPreviewUrl(undefined);
      setFileName(undefined);
      setFileSizeLabel(undefined);
      onChange?.();
    } catch {
      toast.error({ message: t('Something went wrong') });
    }
  };

  return {
    previewUrl,
    fileName,
    fileSizeLabel,
    upload,
    remove,
    isUploading: uploadMutation.isPending,
    isRemoving: updateInstance.isPending,
    uploadError: uploadMutation.error?.message,
  };
}
