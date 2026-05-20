'use client';

import {
  ALLOWED_RESOURCE_MIME_TYPES,
  MAX_RESOURCE_FILE_SIZE,
} from '@op/common';
import { trpc } from '@op/api/client';
import { toast } from '@op/ui/Toast';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

const isAllowedMime = (
  type: string,
): type is (typeof ALLOWED_RESOURCE_MIME_TYPES)[number] =>
  (ALLOWED_RESOURCE_MIME_TYPES as readonly string[]).includes(type);

const MAX_SIZE_MB = MAX_RESOURCE_FILE_SIZE / 1024 / 1024;

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unable to read file'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('File read error'));
    reader.readAsDataURL(file);
  });

export type UploadedResource = {
  storageObjectId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  signedUrl: string;
};

export const useResourceUpload = (profileId: string) => {
  const t = useTranslations();
  const uploadMutation = trpc.resources.uploadFile.useMutation();
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<UploadedResource | null>(null);

  const upload = async (file: File): Promise<UploadedResource | null> => {
    if (!isAllowedMime(file.type)) {
      toast.error({ message: t('Unsupported file type') });
      return null;
    }
    if (file.size > MAX_RESOURCE_FILE_SIZE) {
      toast.error({
        message: t('File is too large (max {size} MB)', { size: MAX_SIZE_MB }),
      });
      return null;
    }

    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await uploadMutation.mutateAsync({
        profileId,
        file: base64,
        fileName: file.name,
        mimeType: file.type,
      });
      setUploaded(result);
      return result;
    } catch (err) {
      toast.error({
        message:
          err instanceof Error ? err.message : t('Could not add resource'),
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const reset = () => setUploaded(null);

  return { upload, uploading, uploaded, reset };
};
