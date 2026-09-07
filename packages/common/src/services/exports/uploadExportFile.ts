import { createSBServiceClient } from '@op/supabase/server';

import { EXPORTS_BUCKET, EXPORT_URL_TTL_SECONDS } from './constants';
import { signExportDownloadUrl } from './signedUrl';

export interface UploadedExportFile {
  /** Signed download URL, which asks Supabase for an attachment. */
  signedUrl: string;
  /**
   * When {@link signedUrl} lapses, as an ISO string.
   *
   * Pinned to the signature rather than recomputed by the caller. Both callers
   * run inside a memoized Inngest step, so a retry reuses this value. Computing
   * it after the step moved the recorded expiry past the real one, and the
   * staleness check trusts the record.
   */
  urlExpiresAt: string;
}

/**
 * Write one generated export to {@link EXPORTS_BUCKET} and sign a download for
 * it.
 *
 * The service-role client is what makes this work at all: RLS on
 * `storage.objects` grants no caller any access in this bucket, so a background
 * job holds the only client that can write or sign here. Every caller settles
 * authorization before the job is queued.
 *
 * `upsert: false`, because each run mints a fresh file name. A collision means
 * two runs picked the same UUID, which is a failure worth surfacing rather than
 * one export silently overwriting another's file.
 *
 * @param filePath - Object key inside {@link EXPORTS_BUCKET}. Each pipeline owns
 *   its own key format.
 * @param fileName - Name the browser saves the object under.
 * @param content - The rendered file.
 * @param mimeType - Content type recorded on the object.
 * @returns The signed URL and the expiry to record beside it.
 * @throws Error when the upload fails, or when signing does.
 */
export const uploadExportFile = async ({
  filePath,
  fileName,
  content,
  mimeType,
}: {
  filePath: string;
  fileName: string;
  content: string;
  mimeType: string;
}): Promise<UploadedExportFile> => {
  const supabase = createSBServiceClient();

  const { error: uploadError } = await supabase.storage
    .from(EXPORTS_BUCKET)
    .upload(filePath, Buffer.from(content), {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const signedUrl = await signExportDownloadUrl({ filePath, fileName });

  return {
    signedUrl,
    urlExpiresAt: new Date(
      Date.now() + EXPORT_URL_TTL_SECONDS * 1000,
    ).toISOString(),
  };
};
