import { relations } from 'drizzle-orm/_relations';
import type { InferModel } from 'drizzle-orm';
import { index, jsonb, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { decisionsVoteProposals } from './decisions_vote_proposals.sql';
import { processInstances } from './processInstances.sql';
import { profiles } from './profiles.sql';

export interface VoteData extends Record<string, unknown> {
  schemaVersion: string;
  schemaType: string;
  submissionMetadata: {
    timestamp: string;
    userAgent?: string;
    [key: string]: unknown;
  };
  validationSignature: string;
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
