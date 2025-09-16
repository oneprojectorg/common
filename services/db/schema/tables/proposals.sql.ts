import { relations } from 'drizzle-orm';
import type { InferModel } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  uuid,
} from 'drizzle-orm/pg-core';

import {
  autoId,
  enumToPgEnum,
  serviceRolePolicies,
  timestamps,
} from '../../helpers';
import { decisions } from './decisions.sql';
import { processInstances } from './processInstances.sql';
import { profiles } from './profiles.sql';
import { proposalAttachments } from './proposalAttachments.sql';
import { taxonomyTerms } from './taxonomies.sql';

export enum ProposalStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export const proposalStatusEnum = pgEnum(
  'decision_proposal_status',
  enumToPgEnum(ProposalStatus),
);

export const proposals = pgTable(
  'decision_proposals',
  {
    id: autoId().primaryKey(),
    processInstanceId: uuid('process_instance_id')
      .notNull()
      .references(() => processInstances.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    // Proposal data following the template schema
    proposalData: jsonb('proposal_data').notNull(),

    submittedByProfileId: uuid('submitted_by_profile_id')
      .notNull()
      .references(() => profiles.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    profileId: uuid('profile_id')
      .references(() => profiles.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      })
      .notNull(),

    status: proposalStatusEnum('status').default(ProposalStatus.DRAFT),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.processInstanceId).concurrently(),
    index().on(table.submittedByProfileId).concurrently(),
    index().on(table.profileId).concurrently(),
    index().on(table.status).concurrently(),
    index('proposals_status_created_at_idx')
      .on(table.status, table.createdAt)
      .concurrently(),
    index('proposals_process_status_idx')
      .on(table.processInstanceId, table.status)
      .concurrently(),
  ],
);

// Junction table for proposal categories (using existing taxonomy system)
export const proposalCategories = pgTable(
  'decision_categories',
  {
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),
    taxonomyTermId: uuid('taxonomy_term_id')
      .notNull()
      .references(() => taxonomyTerms.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),
  },
  (table) => [
    ...serviceRolePolicies,
    primaryKey(table.proposalId, table.taxonomyTermId),
    index('proposalCategories_taxonomyTermId_index').on(table.taxonomyTermId),
    index('proposalCategories_proposalId_index').on(table.proposalId),
  ],
);

export const proposalsRelations = relations(proposals, ({ one, many }) => ({
  processInstance: one(processInstances, {
    fields: [proposals.processInstanceId],
    references: [processInstances.id],
  }),
  submittedBy: one(profiles, {
    fields: [proposals.submittedByProfileId],
    references: [profiles.id],
  }),
  profile: one(profiles, {
    fields: [proposals.profileId],
    references: [profiles.id],
  }),
  decisions: many(decisions),
  categories: many(proposalCategories),
  attachments: many(proposalAttachments),
  // posts relationship will be handled from the posts side to avoid circular dependencies
}));

export const proposalCategoriesRelations = relations(
  proposalCategories,
  ({ one }) => ({
    proposal: one(proposals, {
      fields: [proposalCategories.proposalId],
      references: [proposals.id],
    }),
    taxonomyTerm: one(taxonomyTerms, {
      fields: [proposalCategories.taxonomyTermId],
      references: [taxonomyTerms.id],
    }),
  }),
);

export type Proposal = InferModel<typeof proposals>;
export type ProposalCategory = InferModel<typeof proposalCategories>;
