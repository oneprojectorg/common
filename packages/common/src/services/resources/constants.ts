import { z } from 'zod';

export const MAX_RESOURCE_FILE_SIZE = 25 * 1024 * 1024;

export const httpUrlSchema = z
  .string()
  .url()
  .max(2048)
  .refine(
    (raw) => {
      try {
        const url = new URL(raw);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'Only http(s) URLs are allowed' },
  );

export const resourcePathPrefix = (profileId: string) =>
  `profile/${profileId}/resources/`;

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
