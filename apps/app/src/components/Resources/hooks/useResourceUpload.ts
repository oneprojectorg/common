'use client';

import { trpc } from '@op/api/client';
import {
  ALLOWED_RESOURCE_MIME_TYPES,
  type AllowedResourceMimeType,
  MAX_RESOURCE_FILE_SIZE,
} from '@op/common/client';
import { toast } from '@op/ui/Toast';
import { useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

export type UploadedResource = {
  profileId: string;
  storageObjectId: string;
  fileName: string;
  mimeType: AllowedResourceMimeType;
  fileSize: number;
  signedUrl: string;
};

export const useResourceUpload = (profileId: string) => {
  const t = useTranslations();
  const uploadMutation = trpc.resources.uploadFile.useMutation();
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<UploadedResource | null>(null);
  // Bump on every upload start. If a slower in-flight call resolves after a
  // newer one was started, its token won't match and we discard the result —
  // otherwise the form would submit metadata for the new file with a
  // storageObjectId pointing at the old one.
  const generation = useRef(0);

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

    const token = ++generation.current;
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await uploadMutation.mutateAsync({
        target: { kind: 'profile', profileId },
        file: base64,
        fileName: file.name,
        mimeType: file.type,
      });
      if (token !== generation.current) {
        return null;
      }
      if (!isAllowedMime(result.mimeType)) {
        throw new Error(t('Unsupported file type'));
      }
      const uploaded: UploadedResource = {
        ...result,
        mimeType: result.mimeType,
      };
      setUploaded(uploaded);
      return uploaded;
    } catch (err) {
      if (token !== generation.current) {
        return null;
      }
      toast.error({
        message:
          err instanceof Error ? err.message : t('Could not add resource'),
      });
      return null;
    } finally {
      if (token === generation.current) {
        setUploading(false);
      }
    }
  };

  const reset = () => {
    generation.current++;
    setUploaded(null);
    setUploading(false);
  };

  return { upload, uploading, uploaded, reset };
};

const MAX_SIZE_MB = MAX_RESOURCE_FILE_SIZE / 1024 / 1024;

const isAllowedMime = (type: string): type is AllowedResourceMimeType =>
  (ALLOWED_RESOURCE_MIME_TYPES as readonly string[]).includes(type);

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
