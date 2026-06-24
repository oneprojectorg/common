import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';

/**
 * Transactional outbox for must-deliver Inngest events.
 *
 * Producers write a row here in the SAME database transaction as the
 * mutation whose effects the event represents (e.g. moderation submission,
 * vote). A drainer cron then publishes undelivered rows to Inngest and marks
 * them delivered. This pattern keeps the event durable across Inngest
 * brownouts without coupling the request's success to the Inngest call.
 */
export const eventOutbox = pgTable(
  'event_outbox',
  {
    id: autoId().primaryKey(),
    eventName: text().notNull(),
    eventData: jsonb().notNull(),
    deliveredAt: timestamp({ withTimezone: true, mode: 'string' }),
    attempts: integer().notNull().default(0),
    lastAttemptAt: timestamp({ withTimezone: true, mode: 'string' }),
    lastError: text(),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    // Drainer only ever scans undelivered rows ordered by createdAt — a
    // partial index keeps the scan cheap as delivered rows accumulate.
    index('event_outbox_undelivered_idx')
      .on(table.createdAt)
      .where(sql`${table.deliveredAt} IS NULL`),
  ],
);

export type EventOutboxRow = typeof eventOutbox.$inferSelect;
