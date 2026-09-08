import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { authUsers } from './authUsers.sql';
import { processInstances } from './processInstances.sql';

export const proposalThemeAnalysisStatusEnum = pgEnum(
  'proposal_theme_analysis_status',
  ['pending', 'processing', 'completed', 'failed'],
);

/**
 * One run of the proposal theme analysis over a decision phase.
 *
 * A row, not a cache entry. The analysis is the output of two model passes over
 * up to a hundred proposals — minutes of work and real money — and `@op/cache`
 * is optional infrastructure whose writes are a silent no-op when `REDIS_URL` is
 * unset. Holding the result there meant a deployment without Redis ran the job,
 * discarded the answer, and left the caller waiting on a record that was never
 * written.
 *
 * The proposals it names live in `result` rather than in a join table. They are
 * a snapshot of what the model was shown: the titles are the ones it reasoned
 * about, and a proposal edited or deleted afterwards should not silently change
 * what an analysis is recorded as having said.
 */
export const proposalThemeAnalyses = pgTable(
  'proposal_theme_analyses',
  {
    id: autoId().primaryKey(),
    processInstanceId: uuid('process_instance_id')
      .notNull()
      .references(() => processInstances.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    /**
     * Who asked. An auth user id rather than a profile id, because the read
     * settles ownership against the caller's auth identity before it checks
     * anything else.
     */
    requestedByAuthUserId: uuid('requested_by_auth_user_id')
      .notNull()
      .references(() => authUsers.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    status: proposalThemeAnalysisStatusEnum('status')
      .notNull()
      .default('pending'),

    /** Themes, common ground, outliers and suggestions. Set once it completes. */
    result: jsonb('result'),

    /** Proposals the run actually read. Set once it completes. */
    analyzedCount: integer('analyzed_count'),
    /**
     * Proposals the phase held when the read started. Recorded beside
     * `analyzedCount` so a partial synthesis cannot read as a claim about the
     * whole process.
     */
    total: integer('total'),

    /** What the app renders for a failure. Translated by code, not by message. */
    errorCode: text('error_code'),
    /** English diagnostic. Logged and read while debugging; never rendered. */
    errorMessage: text('error_message'),

    completedAt: timestamp({ withTimezone: true, mode: 'string' }),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    // Reads are "this instance's runs, newest first" — the shape a facilitator
    // reopening a recent analysis needs.
    //
    // Not `.concurrently()`: the migration runner wraps each migration in a
    // transaction, and `CREATE INDEX CONCURRENTLY` cannot run inside one. It
    // would buy nothing here regardless — the table is created by the same
    // migration, so there are no rows to scan and no writers to avoid blocking.
    index('proposal_theme_analyses_instance_created_idx').on(
      table.processInstanceId,
      table.createdAt,
    ),
  ],
);

export type ProposalThemeAnalysis = typeof proposalThemeAnalyses.$inferSelect;
