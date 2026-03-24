import { sql } from 'drizzle-orm';
import type { InferModel } from 'drizzle-orm';
import {
  foreignKey,
  index,
  pgTable,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

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

    proposalHistoryId: uuid('proposal_history_id').notNull(),

    createdAt: timestamp({
      withTimezone: true,
      mode: 'string',
    }).default(sql`(now() AT TIME ZONE 'utc'::text)`),
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.proposalId),
    index().on(table.proposalHistoryId),
    unique().on(table.transitionHistoryId, table.proposalId),
    foreignKey({
      name: 'dtp_proposal_history_fkey',
      columns: [table.proposalId, table.proposalHistoryId],
      foreignColumns: [proposalHistory.id, proposalHistory.historyId],
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
  ],
);

export type DecisionTransitionProposal = InferModel<
  typeof decisionTransitionProposals
>;
