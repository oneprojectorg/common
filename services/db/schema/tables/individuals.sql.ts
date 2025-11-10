import { relations } from 'drizzle-orm';
import type { InferModel } from 'drizzle-orm';
import { index, pgTable, primaryKey, uuid, varchar } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { profiles } from './profiles.sql';
import { taxonomyTerms } from './taxonomies.sql';

export enum PronounsType {
  HE_HIM = 'he-him',
  SHE_HER = 'she-her',
  THEY_THEM = 'they-them',
  CUSTOM = 'custom',
}

// An individual represents the fields unique to individual profiles
export const individuals = pgTable(
  'individuals',
  {
    id: autoId().primaryKey(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),
    pronouns: varchar({ length: 255 }),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.profileId),
  ],
);

export const individualsRelations = relations(individuals, ({ many, one }) => ({
  profile: one(profiles, {
    fields: [individuals.profileId],
    references: [profiles.id],
  }),
  terms: many(individualsTerms),
}));

export const individualsTerms = pgTable(
  'individuals_terms',
  {
    individualId: uuid('individual_id')
      .notNull()
      .references(() => individuals.id, {
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
    primaryKey(table.individualId, table.taxonomyTermId),
    index().on(table.taxonomyTermId),
  ],
);

export const individualsTermsRelations = relations(
  individualsTerms,
  ({ one }) => ({
    organization: one(individuals, {
      fields: [individualsTerms.individualId],
      references: [individuals.id],
    }),
    term: one(taxonomyTerms, {
      fields: [individualsTerms.taxonomyTermId],
      references: [taxonomyTerms.id],
    }),
  }),
);

export type Individual = InferModel<typeof individuals>;
