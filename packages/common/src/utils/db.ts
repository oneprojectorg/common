import { SQL, and, eq, gt, lt, or, sql } from 'drizzle-orm';
import { PgColumn } from 'drizzle-orm/pg-core';

import { CommonError } from './error';

/** Standard sort direction type for database queries */
export type SortDir = 'asc' | 'desc';

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

export const decodeCursor = <T = GenericCursor>(cursor: string): T => {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString()) as T;
  } catch {
    throw new CommonError('Invalid cursor');
  }
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
