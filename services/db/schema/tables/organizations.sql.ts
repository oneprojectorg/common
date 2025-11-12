import { relations } from 'drizzle-orm';
import type { InferModel } from 'drizzle-orm';
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  autoId,
  enumToPgEnum,
  serviceRolePolicies,
  timestamps,
} from '../../helpers';
import { links } from './links.sql';
import { locations } from './locations.sql';
import { profiles } from './profiles.sql';
import { projects } from './projects.sql';
import { organizationRelationships } from './relationships.sql';
import { taxonomyTerms } from './taxonomies.sql';

// Enums for organization types and status
export enum OrgType {
  NONPROFIT = 'nonprofit',
  FORPROFIT = 'forprofit',
  GOVERNMENT = 'government',
  OTHER = 'other',
}

export const orgTypeEnum = pgEnum('org_type', enumToPgEnum(OrgType));

// An organization represents a fields specific to organization type profiles
export const organizations = pgTable(
  'organizations',
  {
    id: autoId().primaryKey(),

    // Used for checking if a user should be automatically added to an organization
    domain: varchar({ length: 255 }),

    // Geography
    isVerified: boolean().default(false),
    networkOrganization: boolean().default(false),

    isOfferingFunds: boolean().default(false),
    isReceivingFunds: boolean().default(false),
    acceptingApplications: boolean().default(false),

    // Organization Type
    orgType: orgTypeEnum('org_type').notNull().default(OrgType.OTHER),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.profileId).concurrently(),
    index().on(table.createdAt).concurrently(),
    index().on(table.updatedAt).concurrently(),
  ],
);

export const organizationsRelations = relations(
  organizations,
  ({ many, one }) => ({
    projects: many(projects),
    links: many(links),
    profile: one(profiles, {
      fields: [organizations.profileId],
      references: [profiles.id],
    }),
    whereWeWork: many(organizationsWhereWeWork),
    strategies: many(organizationsStrategies),
    terms: many(organizationsTerms),
    outgoingRelationships: many(organizationRelationships),
    incomingRelationships: many(organizationRelationships),
  }),
);

export const organizationsTerms = pgTable(
  'organizations_terms',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, {
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
    primaryKey(table.organizationId, table.taxonomyTermId),
    index().on(table.taxonomyTermId),
  ],
);

export const organizationsTermsRelations = relations(
  organizationsTerms,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationsTerms.organizationId],
      references: [organizations.id],
    }),
    term: one(taxonomyTerms, {
      fields: [organizationsTerms.taxonomyTermId],
      references: [taxonomyTerms.id],
    }),
  }),
);

export const organizationsWhereWeWork = pgTable(
  'organizations_where_we_work',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),
  },
  (table) => [
    ...serviceRolePolicies,
    primaryKey(table.organizationId, table.locationId),
    index().on(table.locationId),
  ],
);

export const organizationsWhereWeWorkRelations = relations(
  organizationsWhereWeWork,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationsWhereWeWork.organizationId],
      references: [organizations.id],
    }),
    location: one(locations, {
      fields: [organizationsWhereWeWork.locationId],
      references: [locations.id],
    }),
  }),
);

export const organizationsStrategies = pgTable(
  'organizations_strategies',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, {
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
    primaryKey(table.organizationId, table.taxonomyTermId),
    index().on(table.taxonomyTermId),
  ],
);

export const organizationsStrategiesRelations = relations(
  organizationsStrategies,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationsStrategies.organizationId],
      references: [organizations.id],
    }),
    term: one(taxonomyTerms, {
      fields: [organizationsStrategies.taxonomyTermId],
      references: [taxonomyTerms.id],
    }),
  }),
);

export type Organization = typeof organizations.$inferSelect;
