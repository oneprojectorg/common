import type { SortDir } from '@op/common';
import sanitizeForS3 from 'sanitize-s3-objectkey';
import { z } from 'zod';

/** Standard sort direction schema */
export const sortDir = z.enum(['asc', 'desc']) satisfies z.ZodType<SortDir>;

/**
 * Creates a type-safe sortable schema for a given set of columns
 * @example
 * const userSortable = createSortable(['name', 'email', 'createdAt']);
 * // Results in: { orderBy?: 'name' | 'email' | 'createdAt', dir?: 'asc' | 'desc' }
 */
export const createSortable = <T extends readonly [string, ...string[]]>(
  columns: T,
) =>
  z.object({
    orderBy: z.enum(columns).optional(),
    dir: sortDir.optional(),
  });

/** Generic sortable schema when column types aren't constrained */
const sortableSchema = z.object({
  orderBy: z.string().optional(),
  dir: sortDir.optional(),
});
export type Sortable = z.infer<typeof sortableSchema>;

/**
 * Standard cursor pagination schema for tRPC endpoint inputs
 * @example
 * const inputSchema = z.object({ profileId: z.string() }).merge(paginationSchema);
 * // Results in: { profileId: string, cursor?: string | null, limit: number }
 */
export const paginationSchema = z.object({
  cursor: z.string().nullish(),
  limit: z.number().min(1).max(100).default(25),
});
export type Pagination = z.infer<typeof paginationSchema>;

/**
 * Creates a paginated output schema for tRPC endpoints
 * @example
 * const outputSchema = createPaginatedOutput(userEncoder);
 * // Results in: { items: User[], next: string | null }
 */
export const createPaginatedOutput = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    next: z.string().nullable(),
  });

export const dbFilter = sortableSchema.extend({
  limit: z.number().optional(),
  cursor: z.string().nullish(),
});

export function sanitizeS3Filename(filename: string) {
  if (!filename) {
    return '';
  }

  // Basic sanitization - remove problematic characters
  let sanitized = filename
    // Replace spaces with underscores
    .replace(/\s+/g, '_')
    .replace(/\[|\]/g, '_')
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

  return sanitizeForS3(sanitized, '-');
}

export const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
