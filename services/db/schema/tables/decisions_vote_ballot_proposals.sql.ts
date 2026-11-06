import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  pgTable,
  primaryKey,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { serviceRolePolicies } from '../../helpers';
import { decisionsVoteBallots } from './decisions_vote_ballots.sql';
import { proposals } from './proposals.sql';

/** The picks on an anonymous ballot. No timestamps, like the ballot. */
export const decisionsVoteBallotProposals = pgTable(
  'decisions_vote_ballot_proposals',
  {
    ballotId: uuid('ballot_id')
      .notNull()
      .references(() => decisionsVoteBallots.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    /** 0-based order the picks were cast in; stands in for a creation time. */
    position: integer('position').notNull(),

    // 1-based ballot position; null when the phase is unranked.
    rank: integer('rank'),
  },
  (table) => [
    ...serviceRolePolicies,
    primaryKey({ columns: [table.ballotId, table.proposalId] }),
    index().on(table.proposalId),
    uniqueIndex()
      .on(table.ballotId, table.rank)
      .where(sql`rank IS NOT NULL`),
  ],
);

export type DecisionsVoteBallotProposal =
  typeof decisionsVoteBallotProposals.$inferSelect;
