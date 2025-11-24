import { and, eq, lt, or, sql } from 'drizzle-orm';
import { PgColumn } from 'drizzle-orm/pg-core';

import { CommonError } from './error';

// Cursor utilities
type GenericCursor = {
  date: string;
  id: string;
};

export const decodeCursor = <T = GenericCursor>(cursor: string): T => {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString()) as T;
  } catch {
    throw new CommonError('Invalid cursor');
  }
};

export const encodeCursor = <T = GenericCursor>(cursor: T): string => {
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

export const constructTextSearch = ({
  column,
  query,
}: {
  column: PgColumn;
  query: string;
}) =>
  sql`to_tsvector('english', ${column}) @@to_tsquery('english', ${query.trim().replaceAll(' ', '\\ ') + ':*'})`;
