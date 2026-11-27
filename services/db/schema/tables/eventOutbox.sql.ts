import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';

export const eventOutbox = pgTable(
  'event_outbox',
  {
    id: autoId().primaryKey(),
    eventName: varchar({ length: 255 }).notNull(),
    payload: jsonb().notNull(),
    sentAt: timestamp({ withTimezone: true, mode: 'string' }),
    attempts: integer().default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index('event_outbox_unsent_created_at_idx')
      .on(table.createdAt)
      .where(sql`sent_at IS NULL`),
  ],
);

export type EventOutbox = typeof eventOutbox.$inferSelect;
export type NewEventOutbox = typeof eventOutbox.$inferInsert;
