import { relations, sql } from 'drizzle-orm';
import type { InferModel } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
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
import { posts } from './posts.sql';
import { projects } from './projects.sql';
import { organizationRelationships } from './relationships.sql';
import { objectsInStorage } from './storage.sql';
import { taxonomyTerms } from './taxonomies.sql';

// Enums for organization types and status
export enum OrgType {
  NONPROFIT = 'nonprofit',
  FORPROFIT = 'forprofit',
  GOVERNMENT = 'government',
  OTHER = 'other',
}

export const orgTypeEnum = pgEnum('org_type', enumToPgEnum(OrgType));

// An organization represents a tenant in the system
export const organizations = pgTable(
  'organizations',
  {
    id: autoId().primaryKey(),
    name: varchar({ length: 256 }).notNull(),
    slug: varchar({ length: 256 }).notNull().unique(),
    bio: text(),

    // Mission
    mission: text(),

    // Year Founded
    yearFounded: integer(),

    // Email
    email: varchar({ length: 255 }),
    phone: varchar({ length: 50 }),
    website: varchar({ length: 255 }),

    address: varchar({ length: 255 }),
    city: varchar({ length: 100 }),
    state: varchar({ length: 50 }),
    postalCode: varchar({ length: 20 }),

    // Geography
    // location: geometry('location', { srid: 4326 }),
    isVerified: boolean().default(false),

    isOfferingFunds: boolean().default(false),
    isReceivingFunds: boolean().default(false),

    // Organization Type
    orgType: orgTypeEnum('org_type').notNull().default(OrgType.OTHER),

    // Thematic Areas

    // Media items
    headerImageId: uuid().references(() => objectsInStorage.id, {
      onUpdate: 'cascade',
    }),
    avatarImageId: uuid().references(() => objectsInStorage.id, {
      onUpdate: 'cascade',
    }),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.slug).concurrently(),
    index('organizations_name_gin_index')
      .using('gin', sql`to_tsvector('english', ${table.name})`)
      .concurrently(),
    index('organizations_header_image_id_idx')
      .on(table.headerImageId)
      .concurrently(),
    index('organizations_avatar_image_id_idx')
      .on(table.avatarImageId)
      .concurrently(),
  ],
);

export const organizationsRelations = relations(
  organizations,
  ({ many, one }) => ({
    projects: many(projects),
    links: many(links),
    posts: many(posts),
    whereWeWork: many(organizationsWhereWeWork),
    strategies: many(organizationsStrategies),
    headerImage: one(objectsInStorage, {
      fields: [organizations.headerImageId],
      references: [objectsInStorage.id],
    }),
    avatarImage: one(objectsInStorage, {
      fields: [organizations.avatarImageId],
      references: [objectsInStorage.id],
    }),
    outgoingRelationships: many(organizationRelationships),
    incomingRelationships: many(organizationRelationships),
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
    taxonomyTermId: uuid('taxonomy_term_id')
      .notNull()
      .references(() => taxonomyTerms.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),
  },
  (table) => ({
    pk: primaryKey(table.organizationId, table.taxonomyTermId),
  }),
);

export const organizationsWhereWeWorkRelations = relations(
  organizationsWhereWeWork,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationsWhereWeWork.organizationId],
      references: [organizations.id],
    }),
    term: one(taxonomyTerms, {
      fields: [organizationsWhereWeWork.taxonomyTermId],
      references: [taxonomyTerms.id],
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
  (table) => ({
    pk: primaryKey(table.organizationId, table.taxonomyTermId),
  }),
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

export type Organization = InferModel<typeof organizations>;
