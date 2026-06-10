import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import {
  autoId,
  enumToPgEnum,
  serviceRolePolicies,
  timestamps,
} from '../../helpers';
import { profiles } from './profiles.sql';

/** What kind of item a flag points at (comments are posts). */
export enum ModerationItemType {
  PROPOSAL = 'proposal',
  POST = 'post',
  USER = 'user',
}

/** Lifecycle of a single flag (distinct from the item's own status). */
export enum ModerationFlagStatus {
  PENDING = 'pending', // submitted to the provider, awaiting the async verdict
  FLAGGED = 'flagged', // open flag (provider/user deemed it disallowed)
  CONFIRMED = 'confirmed', // admin confirmed the flag
  DISMISSED = 'dismissed', // false positive
  DISPUTED = 'disputed', // owner contested; awaiting admin
}

/** Who created the flag. */
export enum ModerationSource {
  AUTOMATED = 'automated', // async provider scoring
  MANUAL = 'manual', // a human / admin
}

/** Provider per-category scores (0-1). Keys mirror the moderation service's
 *  `ModerationCategory`; kept as a string record here so the schema doesn't
 *  depend on the service layer. */
export type ModerationScoresData = Record<string, number | undefined>;

export const moderationItemTypeEnum = pgEnum(
  'moderation_item_type',
  enumToPgEnum(ModerationItemType),
);

export const moderationFlagStatusEnum = pgEnum(
  'moderation_flag_status',
  enumToPgEnum(ModerationFlagStatus),
);

export const moderationSourceEnum = pgEnum(
  'moderation_source',
  enumToPgEnum(ModerationSource),
);

/**
 * Audit trail for moderation flags. Records why an item was flagged, links out
 * to the external provider's record (for dispute / admin review), and tracks
 * the review outcome.
 *
 * The flagged item is polymorphic — `itemType` + `itemId` point at a row in
 * whichever table that type lives in (no FK, since the target spans tables).
 */
export const moderationFlags = pgTable(
  'moderation_flags',
  {
    id: autoId().primaryKey(),

    itemType: moderationItemTypeEnum('item_type').notNull(),
    itemId: uuid('item_id').notNull(),

    status: moderationFlagStatusEnum('status')
      .notNull()
      .default(ModerationFlagStatus.FLAGGED),
    source: moderationSourceEnum('source')
      .notNull()
      .default(ModerationSource.AUTOMATED),

    // Provider's per-category scores and a human-readable summary.
    scores: jsonb('scores').$type<ModerationScoresData>(),
    reason: text('reason'),

    // The record id on the external provider. The dispute/review URL is
    // generated from this id (provider fixed by config), not stored per row.
    externalRecordId: text('external_record_id'),

    // Null for automated flags.
    flaggedByProfileId: uuid('flagged_by_profile_id').references(
      () => profiles.id,
      { onDelete: 'set null' },
    ),

    // When the flag was reviewed. We deliberately don't record *who* reviewed:
    // review can happen on the provider's side by people outside our system.
    reviewedAt: timestamp('reviewed_at', {
      withTimezone: true,
      mode: 'string',
    }),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    // Per-item flag history (all statuses).
    index('moderation_flags_item_idx').on(table.itemType, table.itemId),
    // Hot "does this item have an open review?" lookup, and enforces at most
    // one open flag per item (race-safe idempotency). Open = not yet resolved,
    // i.e. `pending` or `flagged`. The predicate is written as "not a terminal
    // status" rather than naming `pending`/`flagged` so it never references a
    // freshly-added enum label: drizzle runs all pending migrations in one
    // transaction, and Postgres rejects using a value added by `ALTER TYPE ...
    // ADD VALUE` in the same transaction. Listing only pre-existing terminal
    // labels keeps the enum-add and this index safe to co-locate.
    uniqueIndex('moderation_flags_open_item_uniq')
      .on(table.itemType, table.itemId)
      .where(sql`status NOT IN ('confirmed', 'dismissed', 'disputed')`),
    // Admin review queue, per-kind tabs: filter by item kind + status, newest first.
    index('moderation_flags_item_status_created_at_idx').on(
      table.itemType,
      table.status,
      table.createdAt,
    ),
    // Admin review queue, "All" tab: filter by status across kinds, newest first.
    index('moderation_flags_status_created_at_idx').on(
      table.status,
      table.createdAt,
    ),
    // flaggedBy FK support + "flags raised by X".
    index('moderation_flags_flagged_by_idx').on(table.flaggedByProfileId),
  ],
);

export type ModerationFlag = typeof moderationFlags.$inferSelect;
