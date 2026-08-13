import { GLOBAL_USER_IDS } from '@op/core';
import { SQL, and, eq, gt, lt, notInArray, or, sql } from 'drizzle-orm';
import { AnyPgColumn, PgColumn } from 'drizzle-orm/pg-core';
import { z } from 'zod';

import { CommonError } from './error';

/** Standard sort direction type for database queries */
export type SortDir = 'asc' | 'desc';

/**
 * Excludes the global access-control sentinel users (e.g. GLOBAL_USER_PUBLIC)
 * from a user/member listing. The public-access grant is anchored on real
 * `users` / `profile_users` rows for these sentinels, so any query that
 * surfaces those rows to people (or counts them) must drop them or they leak
 * as ghost participants. Pass the query's `authUserId` column.
 */
export const excludeGlobalUsers = (authUserIdColumn: AnyPgColumn): SQL =>
  notInArray(authUserIdColumn, [...GLOBAL_USER_IDS]);

/** Generic paginated result type for cursor-based pagination */
export type PaginatedResult<T> = {
  items: T[];
  next: string | null;
};

// Cursor utilities
type GenericCursor = {
  date: Date;
  id: string;
};

/** The return type is an unchecked assertion — see `decodeCursorIfValid`. */
export const decodeCursor = <T = GenericCursor>(cursor: string): T => {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString()) as T;
  } catch {
    throw new CommonError('Invalid cursor');
  }
};

/**
 * Decodes a cursor and discards it when it doesn't match `schema`, so a caller
 * whose cursor shape has changed rewinds to the first page instead of failing
 * the request on a cursor issued by an older deploy. Input that isn't a cursor
 * at all still throws — that's a client bug, not our migration.
 */
export const decodeCursorIfValid = <T>(
  cursor: string,
  schema: z.ZodType<T>,
): T | undefined => {
  const parsed = schema.safeParse(decodeCursor(cursor));

  return parsed.success ? parsed.data : undefined;
};

export const encodeCursor = <T = GenericCursor>(cursor: NoInfer<T>): string => {
  return Buffer.from(JSON.stringify(cursor)).toString('base64');
};

export const getGenericCursorCondition = ({
  columns,
  cursor,
}: {
  columns: { id: PgColumn; date: PgColumn };
  cursor?: GenericCursor;
}) => {
  return cursor
    ? or(
        lt(columns.date, cursor.date),
        and(eq(columns.date, cursor.date), lt(columns.id, cursor.id)),
      )
    : undefined;
};

type Cursor = {
  value: string | Date;
  id?: string;
};

/**
 * Creates a cursor condition that works with any column type and direction.
 * For descending order: get items where value < cursor OR (value = cursor AND id < cursor.id)
 * For ascending order: get items where value > cursor OR (value = cursor AND id > cursor.id)
 *
 * If tieBreakerColumn is not provided, only the primary column comparison is used.
 * This is suitable for columns with high cardinality (like timestamps) where collisions are rare.
 */
export function getCursorCondition(args: {
  column: PgColumn;
  tieBreakerColumn?: PgColumn;
  cursor: Cursor;
  direction: 'asc' | 'desc';
}): SQL;
export function getCursorCondition(args: {
  column: PgColumn;
  tieBreakerColumn?: PgColumn;
  cursor?: Cursor;
  direction: 'asc' | 'desc';
}): SQL | undefined;
export function getCursorCondition({
  column,
  tieBreakerColumn,
  cursor,
  direction,
}: {
  column: PgColumn;
  tieBreakerColumn?: PgColumn;
  cursor?: Cursor;
  direction: 'asc' | 'desc';
}): SQL | undefined {
  if (!cursor) {
    return undefined;
  }

  const compareFn = direction === 'asc' ? gt : lt;

  if (!tieBreakerColumn || !cursor.id) {
    return compareFn(column, cursor.value);
  }

  return or(
    compareFn(column, cursor.value),
    and(eq(column, cursor.value), compareFn(tieBreakerColumn, cursor.id)),
  )!;
}

export const constructTextSearch = ({
  column,
  query,
}: {
  column: PgColumn;
  query: string;
}) =>
  sql`to_tsvector('english', ${column}) @@to_tsquery('english', ${query.trim().replaceAll(' ', '\\ ') + ':*'})`;
