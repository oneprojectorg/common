import { sql } from 'drizzle-orm';
import type { InferModel } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { autoId, enumToPgEnum, serviceRolePolicies, timestamps } from '../../helpers';
import { profiles } from './profiles.sql';

/**
 * What kind of entity a moderation record points at. The subject row is
 * referenced by `(subjectType, subjectId)` rather than a real FK, because the
 * target is polymorphic across tables (mirrors the `profileInvites`
 * denormalized `type + id` pattern). Comments are posts, so `POST` covers both.
 */
export enum ModerationSubjectType {
  PROPOSAL = 'proposal',
  POST = 'post',
  USER = 'user',
}

/** Lifecycle of a single flag (distinct from the subject's own status). */
export enum ModerationRecordStatus {
  FLAGGED = 'flagged', // open; subject is hidden
  UPHELD = 'upheld', // admin confirmed the flag; stays hidden
  DISMISSED = 'dismissed', // false positive; subject restored
  DISPUTED = 'disputed', // owner contested; awaiting admin
}

/** Who created the flag. */
export enum ModerationSource {
  AUTOMATED = 'automated', // async provider scoring
  MANUAL = 'manual', // a human / admin
}

export const moderationSubjectTypeEnum = pgEnum(
  'moderation_subject_type',
  enumToPgEnum(ModerationSubjectType),
);

export const moderationRecordStatusEnum = pgEnum(
  'moderation_record_status',
  enumToPgEnum(ModerationRecordStatus),
);

export const moderationSourceEnum = pgEnum(
  'moderation_source',
  enumToPgEnum(ModerationSource),
);

/**
 * Audit trail for async moderation flags across proposals, posts, and users.
 * Records why a subject was flagged, links out to the external provider's
 * record (for dispute / admin review), and tracks the review outcome.
 */
export const moderationRecords = pgTable(
  'moderation_records',
  {
    id: autoId().primaryKey(),

    // Polymorphic pointer at the flagged row (no FK — target spans tables).
    subjectType: moderationSubjectTypeEnum('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),

    status: moderationRecordStatusEnum('status')
      .notNull()
      .default(ModerationRecordStatus.FLAGGED),
    source: moderationSourceEnum('source')
      .notNull()
      .default(ModerationSource.AUTOMATED),

    // Provider's per-category scores and a human-readable summary.
    scores: jsonb('scores'),
    reason: text('reason'),

    // Click-through to the record on the external provider (dispute / review).
    providerName: text('provider_name'),
    providerRecordId: text('provider_record_id'),
    providerUrl: text('provider_url'),

    // Null for automated flags.
    flaggedByProfileId: uuid('flagged_by_profile_id').references(
      () => profiles.id,
      { onDelete: 'set null' },
    ),

    reviewedByProfileId: uuid('reviewed_by_profile_id').references(
      () => profiles.id,
      { onDelete: 'set null' },
    ),
    reviewedAt: timestamp('reviewed_at', {
      withTimezone: true,
      mode: 'string',
    }),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index('moderation_records_subject_idx').on(
      table.subjectType,
      table.subjectId,
    ),
    // Fast "is this subject currently flagged?" lookups.
    index('moderation_records_open_subject_idx')
      .on(table.subjectType, table.subjectId)
      .where(sql`status = 'flagged'`),
    index('moderation_records_status_idx').on(table.status),
    index('moderation_records_created_at_idx').on(table.createdAt),
    index('moderation_records_flagged_by_idx').on(table.flaggedByProfileId),
    index('moderation_records_reviewed_by_idx').on(table.reviewedByProfileId),
  ],
);

export type ModerationRecord = InferModel<typeof moderationRecords>;
