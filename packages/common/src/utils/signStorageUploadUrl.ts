import { createSBServiceClient } from '@op/supabase/server';
import { randomUUID } from 'node:crypto';

import { CommonError } from './error';
import { sanitizeStorageFileName } from './storage';

/**
 * Issue a Supabase signed upload URL under `<pathPrefix><uuid>_<sanitized>`,
 * returning the (bucket-relative) path Supabase actually recorded plus the
 * signed URL and token the client PUTs to. The UUID prefix guarantees two
 * concurrent uploads of the same filename never collide (Supabase
 * `upsert:false` would reject the second).
 *
 * Lives outside the utils barrel because it imports `@op/supabase/server`
 * (a `server-only` module); the two callers — proposal-attachment and
 * resource sign endpoints — import from this file directly.
 */
export const signStorageUploadUrl = async ({
  bucket,
  pathPrefix,
  fileName,
}: {
  bucket: string;
  pathPrefix: string;
  fileName: string;
}): Promise<{ storagePath: string; signedUrl: string; token: string }> => {
  const sanitized = sanitizeStorageFileName(fileName);
  const storagePath = `${pathPrefix}${randomUUID()}_${sanitized}`;

  const supabase = createSBServiceClient();
  const { data, error } = await supabase.storage
    .from(bucket)
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
