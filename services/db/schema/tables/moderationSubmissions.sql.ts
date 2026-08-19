import { type SQL, sql } from 'drizzle-orm';
import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { autoId, enumToPgEnum, serviceRolePolicies } from '../../helpers';
import {
  type ModerationScoresData,
  moderationItemTypeEnum,
} from './moderationFlags.sql';

/**
 * Per-task verdict for one submission to the provider. Checkstep takes one
 * combined task (text + media as fields), so today an item has a single row
 * here, but the aggregate is written to accept multiple rows per item so
 * per-task splits remain a supported shape.
 */
export enum ModerationSubmissionVerdict {
  PENDING = 'pending', // submitted, awaiting the provider's async verdict
  FLAGGED = 'flagged', // this task came back disallowed
  CLEAR = 'clear', // this task came back allowed
}

export const moderationSubmissionVerdictEnum = pgEnum(
  'moderation_submission_verdict',
  enumToPgEnum(ModerationSubmissionVerdict),
);

/**
 * Tracks each task submitted to the moderation provider for an item, so the
 * webhook can record a per-task verdict and the aggregate decision is
 * independent of the order the provider's callbacks arrive in. A submit
 * replaces the item's prior rows (a fresh round after an edit), so the table
 * always reflects the latest submission's tasks.
 *
 * `mediaId` identifies the task within an item: the sentinel `text` is the
 * text task; otherwise it's the attachment index. Polymorphic on
 * `itemType` + `itemId` like `moderation_flags` (no FK across tables).
 */
export const moderationSubmissions = pgTable(
  'moderation_submissions',
  {
    id: autoId().primaryKey(),

    itemType: moderationItemTypeEnum('item_type').notNull(),
    itemId: uuid('item_id').notNull(),
    // The submission round these tasks belong to. Encoded into the content
    // refs sent to the provider; a webhook verdict must match it, so a
    // delayed callback for a superseded round can't land on the current one.
    roundId: uuid('round_id').notNull(),
    // Task discriminator within the item: `text` or an attachment index.
    mediaId: text('media_id').notNull(),

    verdict: moderationSubmissionVerdictEnum('verdict')
      .notNull()
      .default(ModerationSubmissionVerdict.PENDING),

    // Provider scores/summary for this task, once the verdict arrives.
    scores: jsonb('scores').$type<ModerationScoresData>(),
    reason: text('reason'),
    // The provider's task/record id for this submission, when echoed back.
    externalRecordId: text('external_record_id'),

    // The shared `timestamps` helper minus `deletedAt`: submission rows are
    // bookkeeping for in-flight provider rounds and are deleted outright when
    // a later round supersedes them (or when a failed submit is rolled back)
    // — no soft delete. Resolving a flag deliberately does NOT delete them, so
    // a later decision on the same round still lands.
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
  },
  (table) => [
    ...serviceRolePolicies,
    // One row per (item, task); a re-submit replaces the prior round's rows.
    // Also serves every (itemType, itemId) aggregate lookup as a prefix.
    uniqueIndex('moderation_submissions_item_media_uniq').on(
      table.itemType,
      table.itemId,
      table.mediaId,
    ),
  ],
);

export type ModerationSubmission = typeof moderationSubmissions.$inferSelect;
