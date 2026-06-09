import type { SortDir } from '@op/common';
import crypto from 'crypto';
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

  return sanitizeForS3(filename, '_');
}

/** Short, deterministic digest of a search string for cache keys. */
export function hashSearch(search: string) {
  return crypto.createHash('md5').update(search).digest('hex').substring(0, 16);
}
