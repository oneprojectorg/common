import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies } from '../../helpers';

/**
 * Raw moderation provider deliveries, captured by the webhook route the moment
 * the shared-secret and vendor signature checks pass. Parsing and verdict
 * application happen later in a workflow so the route returns 200 well under
 * the vendor's retry timeout — Lasso/Checkstep/Hive abandon ~10 s and retry
 * aggressively, and the previous inline pipeline (SELECT FOR UPDATE +
 * realtime publish + event emit) routinely tripped that budget on batched
 * deliveries.
 *
 * `deliveryId` is the SHA-256 of the raw body: vendor-agnostic, derivable
 * before parsing, and the same across a redelivery of the same payload. The
 * unique index on `(provider, deliveryId)` is the dedup primitive — a
 * redelivery loses the insert race, the route still 200s the vendor, but no
 * second event is emitted.
 */
export const moderationWebhookInbox = pgTable(
  'moderation_webhook_inbox',
  {
    id: autoId().primaryKey(),

    provider: text('provider').notNull(),
    deliveryId: text('delivery_id').notNull(),

    rawBody: text('raw_body').notNull(),
    headers: jsonb('headers').$type<Record<string, string>>().notNull(),

    receivedAt: timestamp('received_at', {
      withTimezone: true,
      mode: 'string',
    })
      .notNull()
      .default(sql`(now() AT TIME ZONE 'utc'::text)`),

    // Stamped by the dispatch workflow once the payload has been parsed and
    // its verdicts fanned out. Null until then; null + old `received_at`
    // surfaces stuck deliveries.
    processedAt: timestamp('processed_at', {
      withTimezone: true,
      mode: 'string',
    }),
    // `success` (verdicts dispatched, possibly zero), `parse_failed`
    // (provider couldn't parse the body — vendor schema drift), or null while
    // still pending.
    processedStatus: text('processed_status'),
  },
  (table) => [
    ...serviceRolePolicies,
    // Dedup primitive: a vendor redelivery of the same body loses the insert.
    uniqueIndex('moderation_webhook_inbox_provider_delivery_uniq').on(
      table.provider,
      table.deliveryId,
    ),
    // Surfaces stuck deliveries (`processedAt IS NULL` ordered by age).
    index('moderation_webhook_inbox_pending_idx')
      .on(table.receivedAt)
      .where(sql`processed_at IS NULL`),
  ],
);

export type ModerationWebhookInbox = typeof moderationWebhookInbox.$inferSelect;
