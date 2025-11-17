import { relations } from 'drizzle-orm';
import type { InferModel } from 'drizzle-orm';
import { index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, tstzrange } from '../../helpers';
import { processInstances } from './processInstances.sql';
import { profiles } from './profiles.sql';
import { proposalColumns, proposals } from './proposals.sql';

export const proposalHistory = pgTable(
  'decision_proposal_history',
  {
    // Full row snapshot - includes ALL columns from proposals table (except id)
    // This allows using SELECT OLD.* in the trigger
    id: uuid('id').notNull(), // Original proposal ID (from OLD.id)

    ...proposalColumns,

    historyId: autoId().primaryKey(), // Unique ID for this history record
    validDuring: tstzrange('valid_during').notNull(),
    historyCreatedAt: timestamp('history_created_at', {
      withTimezone: true,
      mode: 'string',
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.historyId).concurrently(),
    index().on(table.id).concurrently(), // Original proposal ID
    index().on(table.processInstanceId).concurrently(),
    // GiST index for efficient temporal range queries
    // Note: This will need to be created manually in migration with USING GIST
    index('proposal_history_temporal_idx')
      .on(table.id, table.validDuring)
      .concurrently(),
    index('proposal_history_edited_by_idx')
      .on(table.lastEditedByProfileId)
      .concurrently(),
  ],
);

export const proposalHistoryRelations = relations(
  proposalHistory,
  ({ one }) => ({
    proposal: one(proposals, {
      fields: [proposalHistory.id], // Links to original proposal
      references: [proposals.id],
    }),
    processInstance: one(processInstances, {
      fields: [proposalHistory.processInstanceId],
      references: [processInstances.id],
    }),
    submittedBy: one(profiles, {
      fields: [proposalHistory.submittedByProfileId],
      references: [profiles.id],
    }),
    profile: one(profiles, {
      fields: [proposalHistory.profileId],
      references: [profiles.id],
    }),
    lastEditedBy: one(profiles, {
      fields: [proposalHistory.lastEditedByProfileId],
      references: [profiles.id],
    }),
  }),
);

export type ProposalHistory = InferModel<typeof proposalHistory>;
