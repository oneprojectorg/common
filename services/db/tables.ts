import { PgTable } from 'drizzle-orm/pg-core';

import * as schema from './schema';

// This type is used to remove non-table types (e.g. relations) from the schema
type TableRecord = {
  [K in keyof typeof schema as (typeof schema)[K] extends PgTable
    ? K
    : never]: (typeof schema)[K];
};

export const tables = Object.fromEntries(
  Object.entries(schema).filter(([, value]) => value instanceof PgTable),
) as TableRecord;
