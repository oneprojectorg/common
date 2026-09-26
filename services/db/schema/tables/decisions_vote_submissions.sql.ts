import type { InferModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm/_relations';
import { index, jsonb, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { decisionsVoteProposals } from './decisions_vote_proposals.sql';
import { processInstances } from './processInstances.sql';
import { profiles } from './profiles.sql';

/**
 * The unit a ballot's costs were counted in. Structurally identical to
 * `AmountUnit` in `@op/common`, redeclared here because `services/db` must not
 * import from it.
 */
type BallotAmountUnit =
  | { kind: 'currency'; code: string }
  | { kind: 'custom'; label: string };

export interface VoteData extends Record<string, unknown> {
  schemaVersion: string;
  schemaType: string;
  submissionMetadata: {
    timestamp: string;
    userAgent?: string;
    [key: string]: unknown;
  };
  validationSignature: string;

  // ── Ballot-constraint snapshot (ADR 0006) ───────────────────────────────
  // Optional so no migration is needed and no existing reader breaks. The
  // three budget keys are written together, and only when a budget cap
  // actually applied.

  /** The cap enforced on this ballot, in `budgetUnit`. */
  voterBudget?: number;
  /** The unit the cap and the costs below were counted in. */
  budgetUnit?: BallotAmountUnit;
  /**
   * What the ballot was made of, in submission order.
   *
   * `cost` is `null` when the proposal's budget could not be priced in
   * `budgetUnit` — and on every selection of a ballot that had no budget cap,
   * since costs are only resolved when one applies.
   */
  selections?: Array<{
    proposalId: string;
    cost: number | null;
    /** 1-based position on a ranked ballot; absent on an unranked one. */
    rank?: number;
  }>;
  /** The sum of the costs above, as enforced. */
  totalCost?: number;
}

export const decisionsVoteSubmissions = pgTable(
  'decisions_vote_submissions',
  {
    id: autoId().primaryKey(),

    processInstanceId: uuid('process_instance_id')
      .notNull()
      .references(() => processInstances.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    submittedByProfileId: uuid('submitted_by_profile_id')
      .notNull()
      .references(() => profiles.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    voteData: jsonb('vote_data').$type<VoteData>().notNull(),

    // Custom data collected during voting (untyped JSON)
    customData: jsonb('custom_data').$type<Record<string, unknown>>(),

    // Optional signature
    signature: text(),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.processInstanceId).concurrently(),
    index().on(table.submittedByProfileId).concurrently(),
    index('vote_submissions_instance_id_idx')
      .on(table.processInstanceId, table.id)
      .concurrently(),
    // Ensure one vote submission per person per process instance
    unique().on(table.processInstanceId, table.submittedByProfileId),
  ],
);

export const decisionsVoteSubmissionsRelations = relations(
  decisionsVoteSubmissions,
  ({ one, many }) => ({
    processInstance: one(processInstances, {
      fields: [decisionsVoteSubmissions.processInstanceId],
      references: [processInstances.id],
    }),
    submittedBy: one(profiles, {
      fields: [decisionsVoteSubmissions.submittedByProfileId],
      references: [profiles.id],
    }),
    voteProposals: many(decisionsVoteProposals),
  }),
);

export type DecisionVoteSubmission = InferModel<
  typeof decisionsVoteSubmissions
>;
