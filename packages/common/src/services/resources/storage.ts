import { cache, invalidate } from '@op/cache';
import { createSBServiceClient } from '@op/supabase/server';

import { CommonError } from '../../utils/error';
import { STORAGE_BUCKET, resourcePathPrefix } from './constants';
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

const sanitizeFileName = (raw: string): string => {
  const base = raw.split(/[/\\]/).pop() ?? raw;
  return base.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 255);
};

export type ResourceUploadUrl = {
  storagePath: string;
  signedUrl: string;
  token: string;
};

export const signResourceUploadUrl = async (input: {
  profileId: string;
  fileName: string;
}): Promise<ResourceUploadUrl> => {
  const sanitizedFileName = sanitizeFileName(input.fileName);
  const storagePath = `${resourcePathPrefix(input.profileId)}${Date.now()}_${sanitizedFileName}`;

  const { data, error } = await supabase()
    .storage.from(STORAGE_BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: false });

  if (error || !data?.signedUrl || !data?.token) {
    throw new CommonError(error?.message ?? 'Could not sign upload URL');
  }

  return {
    storagePath: data.path,
    signedUrl: data.signedUrl,
    token: data.token,
  };
};

export const getResourceSignedUrl = async (
  filePath: string,
): Promise<string | null> => {
  return cache({
    type: 'resourceSignedUrl',
    params: [filePath],
    fetch: async () => {
      const sb = supabase();
      const { data, error } = await sb.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);

      if (error || !data?.signedUrl) {
        return null;
      }
      return data.signedUrl;
    },
    options: {
      ttl: SIGNED_URL_CACHE_TTL_MS,
    },
  });
};

export const deleteResourceObject = async (filePath: string): Promise<void> => {
  const sb = supabase();
  const { error } = await sb.storage.from(STORAGE_BUCKET).remove([filePath]);

  if (error) {
    throw new CommonError(`Failed to delete storage object: ${error.message}`);
  }

  // Bust the signed-URL cache so a re-created or different resource at the
  // same path (or a list view) doesn't serve a token pointing at the deleted
  // object until the 10-min TTL expires.
  await invalidate({ type: 'resourceSignedUrl', params: [filePath] });
};
