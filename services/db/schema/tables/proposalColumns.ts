import { jsonb, uuid } from 'drizzle-orm/pg-core';

import { proposalStatusEnum } from './proposals.sql';
import { profiles } from './profiles.sql';

/**
 * Shared column definitions for proposal snapshots
 * Used by both the proposals table and proposalHistory table
 * to ensure consistency and reduce duplication
 */
export const proposalSnapshotColumns = {
  // Proposal data following the template schema
  proposalData: jsonb('proposal_data').notNull(),

  // Proposal status
  status: proposalStatusEnum('status'),

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
} as const;
