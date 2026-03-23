import { sql } from 'drizzle-orm';
import type { InferModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm/_relations';
import { index, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies } from '../../helpers';
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

    createdAt: timestamp({
      withTimezone: true,
      mode: 'string',
    }).default(sql`(now() AT TIME ZONE 'utc'::text)`),
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.transitionHistoryId),
    index().on(table.proposalId),
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
  }),
);

export type DecisionTransitionProposal = InferModel<
  typeof decisionTransitionProposals
>;
