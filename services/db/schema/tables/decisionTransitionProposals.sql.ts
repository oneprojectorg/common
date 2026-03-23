import { sql } from 'drizzle-orm';
import type { InferModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm/_relations';
import { index, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies } from '../../helpers';
import { proposalHistory } from './proposalHistory.sql';
import { proposals } from './proposals.sql';
import { stateTransitionHistory } from './stateTransitionHistory.sql';

export const decisionTransitionProposals = pgTable(
  'decision_transition_proposals',
  {
    id: autoId().primaryKey(),

    transitionHistoryId: uuid('transition_history_id')
      .notNull()
      .references(() => stateTransitionHistory.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    proposalHistoryId: uuid('proposal_history_id').references(
      () => proposalHistory.historyId,
      {
        onUpdate: 'cascade',
        onDelete: 'set null',
      },
    ),

    createdAt: timestamp({
      withTimezone: true,
      mode: 'string',
    }).default(sql`(now() AT TIME ZONE 'utc'::text)`),
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.transitionHistoryId),
    index().on(table.proposalId),
    index().on(table.proposalHistoryId),
    unique().on(table.transitionHistoryId, table.proposalId),
  ],
);

export const decisionTransitionProposalsRelations = relations(
  decisionTransitionProposals,
  ({ one }) => ({
    transitionHistory: one(stateTransitionHistory, {
      fields: [decisionTransitionProposals.transitionHistoryId],
      references: [stateTransitionHistory.id],
    }),
    proposal: one(proposals, {
      fields: [decisionTransitionProposals.proposalId],
      references: [proposals.id],
    }),
    proposalHistorySnapshot: one(proposalHistory, {
      fields: [decisionTransitionProposals.proposalHistoryId],
      references: [proposalHistory.historyId],
    }),
  }),
);

export type DecisionTransitionProposal = InferModel<
  typeof decisionTransitionProposals
>;
