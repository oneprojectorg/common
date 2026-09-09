import { PAGE_LIMIT } from '@op/types';
import { z } from 'zod';

// The tiers live in @op/types so the schemas there can use them too; this
// re-export keeps every @op/common import path working.
export { PAGE_LIMIT };

/** A named page size: the tiers of `PAGE_LIMIT` minus its `max` bound. */
export type PageLimitTier = Exclude<keyof typeof PAGE_LIMIT, 'max'>;

// ── Envelopes ────────────────────────────────────────────────────────────
//
// Every list a procedure returns is one of two envelopes, and the second
// extends the first:
//
//   { items }        — an envelope with no continuation cursor
//   { items, next }  — one page; `next` is the cursor for the following page,
//                      `null` on the last page
//
// `list` says only that there is no continuation cursor. Any bound on the
// result (an offset input, a fixed cap) is the endpoint's, documented there.
//
// The item key is always `items`. Per-request metadata (a total, a permission
// flag, the parent id) is added with `.extend()` so every list schema stays an
// extension of these two. See ADR-0003.

/** An opaque cursor for the page after this one; `null` on the last page. */
export const next = z.string().nullable();

/**
 * Count of rows matching the request's filters, independent of the page. Add
 * it with `paginated(item).extend({ total })` only when the UI shows the number.
 */
export const total = z.number().int().nonnegative();

/**
 * `{ items: T[] }` — a list envelope with no continuation cursor. Any bound on
 * the result is the endpoint's, not this schema's.
 */
export const list = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item) });

/** `{ items: T[], next: string | null }` — one page of a cursor-paginated list. */
export const paginated = <T extends z.ZodType>(item: T) =>
  list(item).extend({ next });

/** Return type of a paginated service; matches `paginated(item)`. */
export type Paginated<T> = { items: T[]; next: string | null };

// ── Inputs ───────────────────────────────────────────────────────────────

/**
 * Cursor pagination input for a list procedure. `cursor` is nullish so the
 * first request and `useInfiniteQuery`'s `initialCursor` can omit it; `limit`
 * defaults to the tier the caller names and is capped at `PAGE_LIMIT.max`.
 *
 * @example
 * .input(z.object({ profileId: z.uuid() }).extend(paginationInput('md').shape))
 */
export const paginationInput = (tier: PageLimitTier = 'md') =>
  z.object({
    cursor: z.string().nullish(),
    limit: z
      .number()
      .int()
      .min(1)
      .max(PAGE_LIMIT.max)
      .default(PAGE_LIMIT[tier]),
  });

export type PaginationInput = z.infer<ReturnType<typeof paginationInput>>;

/**
 * `getNextPageParam` for any `paginated` output. TanStack Query v5 treats a
 * `null` return as "no next page", so no `?? undefined` is needed.
 */
export const nextCursor = <P extends { next: string | null }>(page: P) =>
  page.next;
