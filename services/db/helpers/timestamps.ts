import { sql } from 'drizzle-orm';
import { timestamp } from 'drizzle-orm/pg-core';

import type { SQL } from 'drizzle-orm';

export const timestamps = {
  createdAt: timestamp({
    withTimezone: true,
    mode: 'string',
  }).default(sql`(now() AT TIME ZONE 'utc'::text)`),
  updatedAt: timestamp({
    withTimezone: true,
    mode: 'string',
  })
    .default(sql`(now() AT TIME ZONE 'utc'::text)`)
    .$onUpdate((): SQL => sql`(now() AT TIME ZONE 'utc'::text)`),
  deletedAt: timestamp({
    withTimezone: true,
    mode: 'string',
  }),
};
