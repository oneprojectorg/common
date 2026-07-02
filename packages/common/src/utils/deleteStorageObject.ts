import { createSBServiceClient } from '@op/supabase/server';

import { ASSETS_BUCKET } from './storage';

/**
 * Best-effort delete of a bucket-relative storage object. Used to clean up the
 * previous object when a hero/banner image is replaced or removed so stale
 * uploads don't accumulate in the shared assets bucket forever. Deliberately
 * swallows errors: a failed cleanup should never block the user-facing update
 * that already succeeded — the worst case is a leaked object, not a broken op.
 *
 * Lives outside the utils barrel because it imports `@op/supabase/server` (a
 * `server-only` module); callers import from this file directly.
 */
export const deleteStorageObject = async ({
  path,
  bucket = ASSETS_BUCKET,
}: {
  path: string;
  bucket?: string;
}): Promise<void> => {
  try {
    const supabase = createSBServiceClient();
    await supabase.storage.from(bucket).remove([path]);
  } catch {
    // Swallow — cleanup is best-effort (see above).
  }
};
