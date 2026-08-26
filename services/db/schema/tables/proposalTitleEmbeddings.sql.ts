import { pgTable, text, uuid } from 'drizzle-orm/pg-core';

import {
  createdUpdatedTimestamps,
  serviceRolePolicies,
  vector,
} from '../../helpers';
import { proposals } from './proposals.sql';

/**
 * Dimensionality of the stored title vectors, fixed by the column type.
 *
 * Matches `text-embedding-3-small`, the default `AI_EMBEDDING_MODEL`. Pointing
 * `AI_EMBEDDING_MODEL` at a model with a different width needs a migration, so
 * writers check the returned width against this before inserting rather than
 * letting Postgres reject the row.
 */
export const PROPOSAL_TITLE_EMBEDDING_DIMENSIONS = 1536;

/**
 * Embedding of a proposal's current title, used to rank merge suggestions by
 * how close they are to the proposal being merged away.
 *
 * A side table rather than a column on `decision_proposals`: `proposalColumns`
 * is copied verbatim into `proposal_history` by `proposal_history_trigger`, and
 * a derived cache of the *current* title has no business being versioned — a
 * historical row would carry a vector nothing can use.
 *
 * `title` is the exact text that produced `embedding`, so a refresh can skip the
 * inference call when the title hasn't moved. It mirrors `profiles.name` (the
 * live title — `proposal_data.title` is frozen at creation), which is also why
 * this is a cache and not a source of truth: a missing or stale row degrades the
 * suggestion list to recency order, it never hides a proposal.
 *
 * Deliberately unindexed. Every read is already scoped to one decision's
 * proposals and filtered by phase, visibility and moderation, so an HNSW index
 * wouldn't be used; an exact scan over that handful of rows also avoids the
 * recall loss an approximate index would introduce.
 */
export const proposalTitleEmbeddings = pgTable(
  'decision_proposal_title_embeddings',
  {
    proposalId: uuid('proposal_id')
      .primaryKey()
      .references(() => proposals.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),
    title: text('title').notNull(),
    embedding: vector('embedding', {
      dimensions: PROPOSAL_TITLE_EMBEDDING_DIMENSIONS,
    }).notNull(),
    // No `deletedAt`: the row is a cache keyed on a proposal that cascades away
    // with it, so there is nothing a soft delete would preserve.
    ...createdUpdatedTimestamps,
  },
  () => [...serviceRolePolicies],
);

export type ProposalTitleEmbedding =
  typeof proposalTitleEmbeddings.$inferSelect;
