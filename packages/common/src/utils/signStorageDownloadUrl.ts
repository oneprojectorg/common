import { logger } from '@op/logging';
import { createSBServiceClient } from '@op/supabase/server';

import { CommonError } from './error';
import { ASSETS_BUCKET } from './storage';

// Service-role: private buckets have no storage policy. Authorize before calling.
// Lives outside the utils barrel because `@op/supabase/server` is server-only.
export const signStorageDownloadUrl = async ({
  bucket = ASSETS_BUCKET,
  storagePath,
  ttlSeconds,
  downloadAs,
}: {
  bucket?: string;
  storagePath: string;
  ttlSeconds: number;
  // Forces `Content-Disposition: attachment` under this file name.
  downloadAs?: string;
}): Promise<string> => {
  const supabase = createSBServiceClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(
      storagePath,
      ttlSeconds,
      downloadAs === undefined ? undefined : { download: downloadAs },
    );

  if (error || !data?.signedUrl) {
    throw new CommonError(error?.message ?? 'Could not sign download URL');
  }

  return data.signedUrl;
};

// Null, not a throw: a missing link degrades one attachment, not the whole read.
export const signStorageDownloadUrlOrNull = async ({
  storagePath,
  ttlSeconds,
}: {
  storagePath: string;
  ttlSeconds: number;
}): Promise<string | null> => {
  try {
    return await signStorageDownloadUrl({ storagePath, ttlSeconds });
  } catch (error) {
    if (error instanceof CommonError) {
      logger.warn('Could not sign storage download URL', {
        storagePath,
        error,
      });
      return null;
    }
    throw error;
  }
};
