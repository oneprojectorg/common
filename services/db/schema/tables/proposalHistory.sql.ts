import { relations } from 'drizzle-orm';
import type { InferModel } from 'drizzle-orm';
import { index, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies } from '../../helpers';
import { proposals, proposalStatusEnum } from './proposals.sql';
import { profiles } from './profiles.sql';

export const proposalHistory = pgTable(
  'decision_proposal_history',
  {
    id: autoId().primaryKey(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    // Snapshot of proposal data at this point in time
    proposalData: jsonb('proposal_data').notNull(),

    // Snapshot of status at this point in time
    status: proposalStatusEnum('status').notNull(),

    // Snapshot of the original submitter (typically doesn't change)
    submittedByProfileId: uuid('submitted_by_profile_id')
      .notNull()
      .references(() => profiles.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    // Snapshot of the proposal's profile (typically doesn't change)
    profileId: uuid('profile_id')
      .references(() => profiles.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      })
      .notNull(),

    // Who made the edit that created this version
    editedByProfileId: uuid('edited_by_profile_id')
      .references(() => profiles.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      })
      .notNull(),

    // Temporal validity range
    validFrom: timestamp('valid_from', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),

    validTo: timestamp('valid_to', {
      withTimezone: true,
      mode: 'string',
    }), // NULL for current version

    // When this history record was created
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.proposalId).concurrently(),
    index().on(table.validFrom).concurrently(),
    index('proposal_history_temporal_idx')
      .on(table.proposalId, table.validFrom, table.validTo)
      .concurrently(),
    index('proposal_history_edited_by_idx')
      .on(table.editedByProfileId)
      .concurrently(),
  ],
);

export const proposalHistoryRelations = relations(
  proposalHistory,
  ({ one }) => ({
    proposal: one(proposals, {
      fields: [proposalHistory.proposalId],
      references: [proposals.id],
    }),
    submittedBy: one(profiles, {
      fields: [proposalHistory.submittedByProfileId],
      references: [profiles.id],
    }),
    profile: one(profiles, {
      fields: [proposalHistory.profileId],
      references: [profiles.id],
    }),
    editedBy: one(profiles, {
      fields: [proposalHistory.editedByProfileId],
      references: [profiles.id],
    }),
  }),
);

export type ProposalHistory = InferModel<typeof proposalHistory>;
