import { relations } from 'drizzle-orm';
import type { InferModel } from 'drizzle-orm';
import { index, integer, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { decisionProcessResults } from './decisionProcessResults.sql';
import { proposals } from './proposals.sql';

export const decisionProcessResultSelections = pgTable(
  'decision_process_result_selections',
  {
    id: autoId().primaryKey(),
    processResultId: uuid('process_result_id')
      .notNull()
      .references(() => decisionProcessResults.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    // Optional ranking to preserve selection order
    selectionRank: integer('selection_rank'),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index('result_selections_result_idx')
      .on(table.processResultId)
      .concurrently(),
    index('result_selections_proposal_idx')
      .on(table.proposalId)
      .concurrently(),
    // Ensure same proposal can't be selected twice in the same result
    uniqueIndex('result_selections_unique_idx')
      .on(table.processResultId, table.proposalId)
      .concurrently(),
  ],
);

export const decisionProcessResultSelectionsRelations = relations(
  decisionProcessResultSelections,
  ({ one }) => ({
    processResult: one(decisionProcessResults, {
      fields: [decisionProcessResultSelections.processResultId],
      references: [decisionProcessResults.id],
    }),
    proposal: one(proposals, {
      fields: [decisionProcessResultSelections.proposalId],
      references: [proposals.id],
    }),
  }),
);

export type DecisionProcessResultSelection = InferModel<
  typeof decisionProcessResultSelections
>;
