import { z } from 'zod';

import { DEFAULT_UPLOAD_SIZE_LIMIT } from '../../utils/storage';
import { zodUrlRefine } from '../../utils/validation';

export const MAX_RESOURCE_FILE_SIZE = DEFAULT_UPLOAD_SIZE_LIMIT;

// Title/description length caps. Mirrored by zod `.max()` on every
// create/update procedure input and by client `maxLength` on the form
// inputs — pull from here so the two layers can't drift.
export const RESOURCE_TITLE_MAX_LEN = 50;
export const RESOURCE_DESCRIPTION_MAX_LEN = 250;

export const STORAGE_BUCKET = 'assets';

// SSRF gate: loopback, link-local, RFC1918, CGNAT, metadata services.
// Doesn't cover DNS rebinding — fetchers should use a DNS-pinning HTTP client.
const PRIVATE_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^::1$/,
  /^::ffff:/i,
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
  /^metadata$/i,
  /^metadata\.google\.internal$/i,
  /^instance-data$/i,
  /^instance-data\.ec2\.internal$/i,
];

const isPublicHttpUrl = (raw: string): boolean => {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }
    const stripped = url.hostname.replace(/^\[|\]$/g, '');
    return !PRIVATE_HOST_PATTERNS.some((p) => p.test(stripped));
  } catch {
    return false;
  }
};

// Not `zodUrl` — that helper auto-prefixes `https://`, caps at 200, and is
// `.optional()`. Reuse the format regex via `zodUrlRefine`, then layer
// http(s)-only + private-host rejection.
export const httpUrlSchema = z
  .string()
  .max(2048)
  .refine(zodUrlRefine, { message: 'Must be a valid URL' })
  .refine(isPublicHttpUrl, { message: 'Only public http(s) URLs are allowed' });

export const resourcePathPrefix = (profileId: string) =>
  `profile/${profileId}/resources/`;
