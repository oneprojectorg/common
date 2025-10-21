import { relations } from 'drizzle-orm';
import type { InferModel } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { processInstances } from './processInstances.sql';
import { proposals } from './proposals.sql';

export const decisionSelectedProposals = pgTable(
  'decision_selected_proposals',
  {
    id: autoId().primaryKey(),
    processInstanceId: uuid('process_instance_id')
      .notNull()
      .references(() => processInstances.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    selectedAt: timestamp('selected_at', { withTimezone: true }).notNull(),
    selectionData: jsonb('selection_data'),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index('idx_selected_proposals_instance')
      .on(table.processInstanceId)
      .concurrently(),
    index('idx_selected_proposals_proposal')
      .on(table.proposalId)
      .concurrently(),
    unique('idx_selected_proposals_unique').on(
      table.processInstanceId,
      table.proposalId,
    ),
  ],
);

export const decisionSelectedProposalsRelations = relations(
  decisionSelectedProposals,
  ({ one }) => ({
    processInstance: one(processInstances, {
      fields: [decisionSelectedProposals.processInstanceId],
      references: [processInstances.id],
    }),
    proposal: one(proposals, {
      fields: [decisionSelectedProposals.proposalId],
      references: [proposals.id],
    }),
  }),
);

export type DecisionSelectedProposal = InferModel<
  typeof decisionSelectedProposals
>;
