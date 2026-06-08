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
  FLAGGED = 'flagged', // open flag
  CONFIRMED = 'confirmed', // admin confirmed the flag
  DISMISSED = 'dismissed', // false positive
  DISPUTED = 'disputed', // owner contested; awaiting admin
}

/** Who created the flag. */
export enum ModerationSource {
  AUTOMATED = 'automated', // async provider scoring
  MANUAL = 'manual', // a human / admin
}

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
    scores: jsonb('scores'),
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
    // Hot "is this item currently flagged?" lookup, and enforces at most one
    // open flag per item (race-safe idempotency for flagContent).
    uniqueIndex('moderation_flags_open_item_uniq')
      .on(table.itemType, table.itemId)
      .where(sql`status = 'flagged'`),
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
