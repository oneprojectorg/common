import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { timestamp } from 'drizzle-orm/pg-core';

/**
 * For tables that are hard-deleted: bookkeeping rows and derived caches, where
 * a soft delete would preserve nothing anyone can use.
 */
export const createdUpdatedTimestamps = {
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
};

export const timestamps = {
  ...createdUpdatedTimestamps,
  deletedAt: timestamp({
    withTimezone: true,
    mode: 'string',
  }),
};
