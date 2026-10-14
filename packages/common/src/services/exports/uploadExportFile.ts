import { createSBServiceClient } from '@op/supabase/server';

import { EXPORTS_BUCKET, EXPORT_URL_TTL_SECONDS } from './constants';
import { signExportDownloadUrl } from './signedUrl';

export interface UploadedExportFile {
  signedUrl: string;
  urlExpiresAt: string;
}

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
