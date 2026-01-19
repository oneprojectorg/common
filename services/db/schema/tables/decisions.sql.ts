import type { InferModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm/_relations';
import { index, jsonb, pgTable, unique, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { profiles } from './profiles.sql';
import { proposals } from './proposals.sql';

export const decisions = pgTable(
  'decision_instances',
  {
    id: autoId().primaryKey(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    // Decision data following the voting definition schema
    decisionData: jsonb('decision_data').notNull(),

    decidedByProfileId: uuid('decided_by_profile_id')
      .notNull()
      .references(() => profiles.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.proposalId).concurrently(),
    index().on(table.decidedByProfileId).concurrently(),
    // Ensure one decision per person per proposal
    unique().on(table.proposalId, table.decidedByProfileId),
  ],
);

export const decisionsRelations = relations(decisions, ({ one }) => ({
  proposal: one(proposals, {
    fields: [decisions.proposalId],
    references: [proposals.id],
  }),
  decidedBy: one(profiles, {
    fields: [decisions.decidedByProfileId],
    references: [profiles.id],
  }),
}));

export type Decision = InferModel<typeof decisions>;
