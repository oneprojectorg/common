import { sql } from 'drizzle-orm';
import { uuid } from 'drizzle-orm/pg-core';

export const autoId = () =>
  uuid()
    .default(sql`gen_random_uuid()`)
    .notNull();
