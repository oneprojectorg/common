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
import { processInstances } from './processInstances.sql';
import { proposalHistory } from './proposalHistory.sql';
import { proposals } from './proposals.sql';
import { stateTransitionHistory } from './stateTransitionHistory.sql';

export const decisionTransitionProposals = pgTable(
  'decision_transition_proposals',
  {
    id: autoId().primaryKey(),

    processInstanceId: uuid('process_instance_id')
      .notNull()
      .references(() => processInstances.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    transitionHistoryId: uuid('transition_history_id').notNull(),

    proposalId: uuid('proposal_id').notNull(),

    proposalHistoryId: uuid('proposal_history_id').notNull(),

    createdAt: timestamp({
      withTimezone: true,
      mode: 'string',
    }).default(sql`(now() AT TIME ZONE 'utc'::text)`),
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.processInstanceId),
    index().on(table.transitionHistoryId),
    index().on(table.proposalId),
    index().on(table.proposalHistoryId),
    unique().on(table.transitionHistoryId, table.proposalId),

    // Composite FKs ensure all references belong to the same process instance
    foreignKey({
      name: 'dtp_transition_history_fkey',
      columns: [table.processInstanceId, table.transitionHistoryId],
      foreignColumns: [
        stateTransitionHistory.processInstanceId,
        stateTransitionHistory.id,
      ],
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    foreignKey({
      name: 'dtp_proposal_fkey',
      columns: [table.processInstanceId, table.proposalId],
      foreignColumns: [proposals.processInstanceId, proposals.id],
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    foreignKey({
      name: 'dtp_proposal_history_fkey',
      columns: [
        table.processInstanceId,
        table.proposalId,
        table.proposalHistoryId,
      ],
      foreignColumns: [
        proposalHistory.processInstanceId,
        proposalHistory.id,
        proposalHistory.historyId,
      ],
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
  ],
);

export type DecisionTransitionProposal = InferModel<
  typeof decisionTransitionProposals
>;
