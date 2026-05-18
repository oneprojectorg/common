import { createSBServiceClient } from '@op/supabase/server';
import { Buffer } from 'buffer';

import { CommonError } from '../../utils/error';

const BUCKET = 'assets';
const SIGNED_URL_TTL_SECONDS = 60 * 60;
export const MAX_RESOURCE_FILE_SIZE = 25 * 1024 * 1024;

export const resourcePathPrefix = (profileId: string) =>
  `profile/${profileId}/resources/`;

let cachedClient: ReturnType<typeof createSBServiceClient> | null = null;
const supabase = () => {
  if (!cachedClient) {
    cachedClient = createSBServiceClient();
  }
  return cachedClient;
};

export const ALLOWED_RESOURCE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'text/plain',
] as const;

export type AllowedResourceMimeType =
  (typeof ALLOWED_RESOURCE_MIME_TYPES)[number];

export const isAllowedResourceMimeType = (
  mimeType: string,
): mimeType is AllowedResourceMimeType =>
  (ALLOWED_RESOURCE_MIME_TYPES as readonly string[]).includes(mimeType);

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
  const sb = supabase();
  const { data, error } = await sb.storage
    .from(BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return null;
  }
  return data.signedUrl;
};

export const deleteResourceObject = async (filePath: string): Promise<void> => {
  const sb = supabase();
  const { error } = await sb.storage.from(BUCKET).remove([filePath]);

  if (error) {
    throw new CommonError(`Failed to delete storage object: ${error.message}`);
  }
};
