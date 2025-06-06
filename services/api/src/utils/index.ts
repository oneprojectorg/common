import { z } from 'zod';

export const dbFilter = z.object({
  limit: z.number().optional(),
});

export function sanitizeS3Filename(filename: string) {
  if (!filename) {
    return '';
  }

  // Basic sanitization - remove problematic characters
  let sanitized = filename
    // Replace spaces with underscores
    .replace(/\s+/g, '_')
    // Remove problematic characters for S3
    .replace(/[&$@=;:+,?\\{^}%`\]>[~#|]/g, '')
    // Remove control characters (ASCII 0-31) and DEL (127)
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Remove leading and trailing periods or slashes
    .replace(/^[./]+|[./]+$/g, '')
    // Replace multiple consecutive underscores with a single one
    .replace(/_+/g, '_');

  // Ensure the key doesn't start with these special characters
  sanitized = sanitized.replace(/^[!-.* ]/g, '');

  // Limit length (optional, modify as needed)
  const maxLength = 1024; // S3 allows up to 1024 bytes for key length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}
