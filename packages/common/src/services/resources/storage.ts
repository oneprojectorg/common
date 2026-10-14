import { cache, invalidate } from '@op/cache';
import { createSBServiceClient } from '@op/supabase/server';

import { CommonError } from '../../utils/error';
import { signStorageDownloadUrl } from '../../utils/signStorageDownloadUrl';
import { signStorageUploadUrl } from '../../utils/signStorageUploadUrl';
import { ASSETS_BUCKET } from '../../utils/storage';
import { resourcePathPrefix } from './constants';
// Cache 10 min so list views don't fan out into N sign requests; sign for
// 15 min so cached tokens always have 5 min of headroom.
const SIGNED_URL_TTL_SECONDS = 15 * 60;
const SIGNED_URL_CACHE_TTL_MS = 10 * 60 * 1000;

let cachedClient: ReturnType<typeof createSBServiceClient> | null = null;
const supabase = () => {
  if (!cachedClient) {
    cachedClient = createSBServiceClient();
  }
  return cachedClient;
};

export type ResourceUploadUrl = {
  storagePath: string;
  signedUrl: string;
  token: string;
};

export const signResourceUploadUrl = (input: {
  profileId: string;
  fileName: string;
}): Promise<ResourceUploadUrl> =>
  signStorageUploadUrl({
    pathPrefix: resourcePathPrefix(input.profileId),
    fileName: input.fileName,
  });

// Null, not a throw: a list view degrades to a missing link rather than failing.
const signOrNull = async (
  filePath: string,
  ttlSeconds: number,
): Promise<string | null> => {
  try {
    return await signStorageDownloadUrl({ storagePath: filePath, ttlSeconds });
  } catch (error) {
    if (error instanceof CommonError) {
      return null;
    }
    throw error;
  }
};

export const getResourceSignedUrl = async (
  filePath: string,
): Promise<string | null> => {
  return cache({
    type: 'resourceSignedUrl',
    params: [filePath],
    fetch: () => signOrNull(filePath, SIGNED_URL_TTL_SECONDS),
    options: {
      ttl: SIGNED_URL_CACHE_TTL_MS,
    },
  });
};

// External services (e.g. the moderation provider) fetch on their own
// schedule — possibly hours after submission and across our retries — so the
// 15-min read URLs above would routinely expire under them. 24h matches the
// attachment-signing TTL used elsewhere (e.g. getProposal).
const EXTERNAL_SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;

/** Uncached, long-lived signed URL for handing to an external service. Not
 *  for list views — use {@link getResourceSignedUrl} there, where the cache
 *  prevents per-row sign requests. */
export const getExternalResourceSignedUrl = (
  filePath: string,
): Promise<string | null> =>
  signOrNull(filePath, EXTERNAL_SIGNED_URL_TTL_SECONDS);

export const deleteResourceObject = async (filePath: string): Promise<void> => {
  const sb = supabase();
  const { error } = await sb.storage.from(ASSETS_BUCKET).remove([filePath]);

  if (error) {
    throw new CommonError(`Failed to delete storage object: ${error.message}`);
  }

  // Bust the signed-URL cache so a re-created or different resource at the
  // same path (or a list view) doesn't serve a token pointing at the deleted
  // object until the 10-min TTL expires.
  await invalidate({ type: 'resourceSignedUrl', params: [filePath] });
};
