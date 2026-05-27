import { cache } from '@op/cache';
import { createSBServiceClient } from '@op/supabase/server';
import { Buffer } from 'buffer';

import { CommonError } from '../../utils/error';
import { MAX_RESOURCE_FILE_SIZE, isAllowedResourceMimeType } from './constants';

const BUCKET = 'assets';
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

const decodeBase64File = (input: string): Buffer => {
  let base64 = input;

  if (input.startsWith('data:')) {
    const commaIndex = input.indexOf(',');
    if (commaIndex === -1) {
      throw new CommonError('Invalid data URL');
    }
    base64 = input.slice(commaIndex + 1);
  }

  try {
    return Buffer.from(base64, 'base64');
  } catch {
    throw new CommonError('Invalid base64 encoding');
  }
};

// Magic-byte check to catch lies in `mimeType` (e.g. .exe declared as PDF).
// text/csv and text/plain have no header — declared mimeType is trusted.
const MIME_SIGNATURES: Record<string, Uint8Array[]> = {
  'image/png': [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  ],
  'image/jpeg': [new Uint8Array([0xff, 0xd8, 0xff])],
  'image/webp': [new Uint8Array([0x52, 0x49, 0x46, 0x46])], // RIFF — webp also has 'WEBP' at offset 8
  'image/gif': [
    new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]),
    new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
  ],
  'application/pdf': [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], // %PDF-
  // ZIP-based (DOCX/XLSX/PPTX) — PK\x03\x04 or PK\x05\x06.
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]),
  ],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]),
  ],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': [
    new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]),
  ],
};

const headerMatches = (buffer: Buffer, header: Uint8Array): boolean => {
  if (buffer.length < header.length) {
    return false;
  }
  for (let i = 0; i < header.length; i++) {
    if (buffer[i] !== header[i]) {
      return false;
    }
  }
  return true;
};

const assertMimeMatchesContent = (buffer: Buffer, mimeType: string): void => {
  const headers = MIME_SIGNATURES[mimeType];
  if (!headers) {
    return;
  }
  if (!headers.some((h) => headerMatches(buffer, h))) {
    throw new CommonError('File content does not match declared file type');
  }
  // RIFF also covers WAV/AVI — disambiguate via 'WEBP' at offset 8.
  if (mimeType === 'image/webp') {
    const webpTag = buffer.subarray(8, 12).toString('ascii');
    if (webpTag !== 'WEBP') {
      throw new CommonError('File content does not match declared file type');
    }
  }
};

export type UploadResourceFileInput = {
  profileId: string;
  base64File: string;
  fileName: string;
  mimeType: string;
};

export type UploadedResourceFile = {
  storageObjectId: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  signedUrl: string;
};

export const uploadResourceFile = async (
  input: UploadResourceFileInput,
): Promise<UploadedResourceFile> => {
  if (!isAllowedResourceMimeType(input.mimeType)) {
    throw new CommonError('Unsupported file type.');
  }

  const buffer = decodeBase64File(input.base64File);

  if (buffer.length > MAX_RESOURCE_FILE_SIZE) {
    throw new CommonError(
      `File too large. Maximum size is ${MAX_RESOURCE_FILE_SIZE / 1024 / 1024} MB`,
    );
  }

  assertMimeMatchesContent(buffer, input.mimeType);

  const sanitizedFileName = sanitizeFileName(input.fileName);
  const filePath = `profile/${input.profileId}/resources/${Date.now()}_${sanitizedFileName}`;

  const sb = supabase();

  const { error: uploadError, data: uploadData } = await sb.storage
    .from(BUCKET)
    .upload(filePath, buffer, {
      contentType: input.mimeType,
      upsert: false,
    });

  if (uploadError || !uploadData) {
    throw new CommonError(uploadError?.message ?? 'Upload failed');
  }

  const { data: signedData, error: signedError } = await sb.storage
    .from(BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);

  if (signedError || !signedData?.signedUrl) {
    throw new CommonError('Could not get signed URL');
  }

  return {
    storageObjectId: uploadData.id,
    filePath,
    fileName: sanitizedFileName,
    mimeType: input.mimeType,
    fileSize: buffer.length,
    signedUrl: signedData.signedUrl,
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
        .from(BUCKET)
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
  const { error } = await sb.storage.from(BUCKET).remove([filePath]);

  if (error) {
    throw new CommonError(`Failed to delete storage object: ${error.message}`);
  }
};
