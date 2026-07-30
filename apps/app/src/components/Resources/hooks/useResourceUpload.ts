'use client';

import { trpc } from '@op/api/client';
import { toast } from '@op/sense/Sonner';
import { useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

export type UploadedResource = {
  profileId: string;
  storagePath: string;
  fileName: string;
  // Whatever `file.type` was on PUT. Backend validates against the allowlist
  // (and against the storage object's stored Content-Type), so we don't
  // narrow this here.
  mimeType: string;
};

export const useResourceUpload = (profileId: string) => {
  const t = useTranslations();
  const uploadMutation = trpc.resources.uploadFile.useMutation();
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<UploadedResource | null>(null);
  // Bump on every upload start. If a slower in-flight call resolves after a
  // newer one was started, its token won't match and we discard the result —
  // otherwise the form would submit metadata for the new file with a
  // storagePath pointing at the old one.
  const generation = useRef(0);

  const upload = async (file: File): Promise<UploadedResource | null> => {
    const token = ++generation.current;
    setUploading(true);
    try {
      const signed = await uploadMutation.mutateAsync({
        target: { kind: 'profile', profileId },
        fileName: file.name,
      });
      if (token !== generation.current) {
        return null;
      }
      const putRes = await fetch(signed.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (token !== generation.current) {
        return null;
      }
      if (!putRes.ok) {
        throw new Error(t('Could not add resource'));
      }
      const result: UploadedResource = {
        profileId: signed.profileId,
        storagePath: signed.storagePath,
        fileName: file.name,
        mimeType: file.type,
      };
      setUploaded(result);
      return result;
    } catch (err) {
      if (token !== generation.current) {
        return null;
      }
      toast.error(
        err instanceof Error ? err.message : t('Could not add resource'),
      );
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
