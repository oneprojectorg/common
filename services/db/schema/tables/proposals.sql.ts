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
import { taxonomyTerms } from './taxonomies.sql';

export enum ProposalStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export const proposalStatusEnum = pgEnum(
  'proposal_status',
  enumToPgEnum(ProposalStatus),
);

export const proposals = pgTable(
  'proposals',
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
    
    status: proposalStatusEnum('status').default(ProposalStatus.DRAFT),
    
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.processInstanceId).concurrently(),
    index().on(table.submittedByProfileId).concurrently(),
    index().on(table.status).concurrently(),
  ],
);

// Junction table for proposal categories (using existing taxonomy system)
export const proposalCategories = pgTable(
  'proposal_categories',
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
  decisions: many(decisions),
  categories: many(proposalCategories),
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