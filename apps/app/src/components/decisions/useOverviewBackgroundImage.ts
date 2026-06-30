'use client';

import { getPublicUrl } from '@/utils';
import { trpc } from '@op/api/client';
import { toast } from '@op/ui/Toast';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

const ACCEPTED_IMAGE_TYPES = [
  'image/gif',
  'image/png',
  'image/jpeg',
  'image/webp',
];

// The image rides through the tRPC body as base64. Vercel caps the serverless
// request body at ~4.5MB and base64 inflates ~33%, so anything over ~3.3MB raw
// is rejected by the platform (a 413 the tRPC client can't parse as JSON)
// before our handler runs. Cap well under that. Must match
// MAX_BACKGROUND_IMAGE_SIZE in uploadOverviewBackgroundImage.ts.
export const MAX_BACKGROUND_IMAGE_SIZE = 3 * 1024 * 1024;

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
  const uploadMutation =
    trpc.decision.uploadOverviewBackgroundImage.useMutation();
  const updateInstance = trpc.decision.updateDecisionInstance.useMutation();

  const upload = (file: File) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error({
        message: t('That file type is not supported. Accepted types: {types}', {
          types: ACCEPTED_IMAGE_TYPES.map((type) => type.split('/')[1]).join(
            ', ',
          ),
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
      onChange?.();
    } catch {
      toast.error({ message: t('Something went wrong') });
    }
  };

  return {
    previewUrl,
    upload,
    remove,
    isUploading: uploadMutation.isPending,
    isRemoving: updateInstance.isPending,
    uploadError: uploadMutation.error?.message,
  };
}
