import { z } from 'zod';

export const MAX_RESOURCE_FILE_SIZE = 25 * 1024 * 1024;

// Hostnames we never want to fetch on the server side. Catches the
// obvious SSRF foot-guns (loopback, link-local, RFC1918 by literal IP,
// metadata service). DNS rebinding is not addressed here — agents that
// actually fetch the URL should use a DNS-pinning HTTP client.
const PRIVATE_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^::1$/,
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
];

const isPrivateHost = (hostname: string): boolean => {
  const stripped = hostname.replace(/^\[|\]$/g, '');
  return PRIVATE_HOST_PATTERNS.some((p) => p.test(stripped));
};

export const httpUrlSchema = z
  .string()
  .url()
  .max(2048)
  .refine(
    (raw) => {
      try {
        const url = new URL(raw);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          return false;
        }
        if (isPrivateHost(url.hostname)) {
          return false;
        }
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Only public http(s) URLs are allowed' },
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
