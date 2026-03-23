import { sql } from 'drizzle-orm';
import { jsonb, pgEnum, timestamp, uuid } from 'drizzle-orm/pg-core';

import { enumToPgEnum } from '../../helpers';
import { processInstances } from './processInstances.sql';
import { profiles } from './profiles.sql';
import { Visibility, visibilityEnum } from './visibility.sql';

export enum ProposalStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  SHORTLISTED = 'shortlisted',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DUPLICATE = 'duplicate',
  SELECTED = 'selected',
}

export const proposalStatusEnum = pgEnum(
  'decision_proposal_status',
  enumToPgEnum(ProposalStatus),
);

/**
 * ALL fields that are copied to history
 * When adding/removing columns, also update the proposal_history_trigger
 */
export const proposalColumns = {
  // Reference to the process instance
  processInstanceId: uuid('process_instance_id')
    .notNull()
    .references(() => processInstances.id, {
      onUpdate: 'cascade',
      onDelete: 'cascade',
    }),

  // Proposal data following the template schema
  proposalData: jsonb('proposal_data').notNull(),

  // Proposal status (defaults to DRAFT for new proposals)
  status: proposalStatusEnum('status').default(ProposalStatus.DRAFT),

  // Proposal visibility (defaults to VISIBLE)
  visibility: visibilityEnum('visibility')
    .default(Visibility.VISIBLE)
    .notNull(),

  // Who originally submitted this proposal
  submittedByProfileId: uuid('submitted_by_profile_id')
    .notNull()
    .references(() => profiles.id, {
      onUpdate: 'cascade',
      onDelete: 'cascade',
    }),

  // The proposal's own profile (for social features)
  profileId: uuid('profile_id')
    .references(() => profiles.id, {
      onUpdate: 'cascade',
      onDelete: 'cascade',
    })
    .notNull(),

  // Who last edited this proposal (for version history tracking)
  lastEditedByProfileId: uuid('last_edited_by_profile_id').references(
    () => profiles.id,
    {
      onUpdate: 'cascade',
      onDelete: 'cascade',
    },
  ),

  // Timestamps
  createdAt: timestamp({
    withTimezone: true,
    mode: 'string',
  }).default(sql`(now() AT TIME ZONE 'utc'::text)`),

  updatedAt: timestamp({
    withTimezone: true,
    mode: 'string',
  })
    .default(sql`(now() AT TIME ZONE 'utc'::text)`)
    .$onUpdate(() => sql`(now() AT TIME ZONE 'utc'::text)`),

  deletedAt: timestamp({
    withTimezone: true,
    mode: 'string',
  }),
} as const;
