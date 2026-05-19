interface SignedUploadArgs {
  fileName: string;
  mimeType: string;
  fileSize: number;
}

interface SignedUploadFns<TRecord> {
  createUploadUrl: (
    args: SignedUploadArgs,
  ) => Promise<{ signedUrl: string; path: string }>;
  recordUpload: (args: { path: string; fileName: string }) => Promise<TRecord>;
}

const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

async function putFileToSignedUrl(file: File, signedUrl: string) {
  const response = await fetch(signedUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
      'x-upsert': 'false',
    },
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Upload failed (${response.status})${body ? `: ${body.slice(0, 200)}` : ''}`,
    );
  }
}

export async function uploadFileViaSignedUrl<TRecord>(
  file: File,
  { createUploadUrl, recordUpload }: SignedUploadFns<TRecord>,
): Promise<TRecord> {
  const { signedUrl, path } = await createUploadUrl({
    fileName: file.name,
    mimeType: file.type,
    fileSize: file.size,
  });

  await putFileToSignedUrl(file, signedUrl);

  return recordUpload({ path, fileName: file.name });
}
