import { relations } from 'drizzle-orm/_relations';
import type { InferModel } from 'drizzle-orm';
import { index, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';

import { serviceRolePolicies, timestamps } from '../../helpers';
import { decisionsVoteSubmissions } from './decisions_vote_submissions.sql';
import { proposals } from './proposals.sql';

export const decisionsVoteProposals = pgTable(
  'decisions_vote_proposals',
  {
    voteSubmissionId: uuid('vote_submission_id')
      .notNull()
      .references(() => decisionsVoteSubmissions.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    primaryKey({ columns: [table.voteSubmissionId, table.proposalId] }),
    index().on(table.voteSubmissionId).concurrently(),
    index().on(table.proposalId).concurrently(),
  ],
);

export const decisionsVoteProposalsRelations = relations(
  decisionsVoteProposals,
  ({ one }) => ({
    voteSubmission: one(decisionsVoteSubmissions, {
      fields: [decisionsVoteProposals.voteSubmissionId],
      references: [decisionsVoteSubmissions.id],
    }),
    proposal: one(proposals, {
      fields: [decisionsVoteProposals.proposalId],
      references: [proposals.id],
    }),
  }),
);

export type DecisionVoteProposal = InferModel<typeof decisionsVoteProposals>;
