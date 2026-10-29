import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  pgTable,
  primaryKey,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { serviceRolePolicies, timestamps } from '../../helpers';
import { decisionsVoteDrafts } from './decisions_vote_drafts.sql';
import { proposals } from './proposals.sql';

export const decisionsVoteDraftProposals = pgTable(
  'decisions_vote_draft_proposals',
  {
    voteDraftId: uuid('vote_draft_id')
      .notNull()
      .references(() => decisionsVoteDrafts.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    rank: integer('rank'),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    primaryKey({ columns: [table.voteDraftId, table.proposalId] }),
    index().on(table.voteDraftId).concurrently(),
    index().on(table.proposalId).concurrently(),
    uniqueIndex()
      .on(table.voteDraftId, table.rank)
      .where(sql`rank IS NOT NULL`),
  ],
);

export type DecisionsVoteDraftProposal =
  typeof decisionsVoteDraftProposals.$inferSelect;
