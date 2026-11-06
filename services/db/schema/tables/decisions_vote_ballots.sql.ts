import type { AmountUnit } from '@op/types/amountUnit';
import { sql } from 'drizzle-orm';
import {
  date,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies } from '../../helpers';
import { processInstances } from './processInstances.sql';

export interface BallotData extends Record<string, unknown> {
  schemaVersion: string;
  schemaType: string;
  voterBudget?: number;
  /** Template field each selection was charged from, in `costUnit`. */
  voterCostField?: string;
  costUnit?: AmountUnit;
  /** `cost` is null when unpriceable or when no cap applied. */
  selections: Array<{
    proposalId: string;
    cost: number | null;
    rank?: number;
  }>;
  totalCost?: number;
}

/**
 * A cast ballot with no voter on it. `decisions_vote_submissions` records
 * that a profile voted; this row records what was voted for, and nothing
 * joins the two. The voter keeps a random receipt, and the row stores only
 * values derived from it (see `ballotReceipt.ts` in `@op/common`), so only
 * the receipt holder can find it again, or tell whether its picks changed.
 *
 * There are no timestamps, because the clock links a ballot to its
 * submission when voting is sparse. `cast_on` keeps the day only.
 */
export const decisionsVoteBallots = pgTable(
  'decisions_vote_ballots',
  {
    // Random (v4), so the id's order says nothing about when it was cast.
    id: autoId().primaryKey(),

    processInstanceId: uuid('process_instance_id')
      .notNull()
      .references(() => processInstances.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    /** Hex, derived from the receipt and the instance; finds the ballot. */
    receiptHash: text('receipt_hash').notNull(),

    /**
     * Hex MAC over the picks under a key derived from the receipt, so the
     * receipt holder can tell whether the picks are still the ones they cast.
     */
    seal: text('seal').notNull(),

    ballotData: jsonb('ballot_data').$type<BallotData>().notNull(),

    castOn: date('cast_on', { mode: 'string' })
      .notNull()
      // The database runs in UTC.
      .default(sql`CURRENT_DATE`),
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.processInstanceId),
    uniqueIndex().on(table.receiptHash),
  ],
);

export type DecisionsVoteBallot = typeof decisionsVoteBallots.$inferSelect;
