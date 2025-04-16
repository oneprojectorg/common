import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  decimal,
  index,
  integer,
  json,
  pgEnum,
  pgTable,
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

import { projects } from './projects.sql';

// Enums for organization types and status
export enum OrgType {
  COOPERATIVE = 'cooperative',
  MUTUAL_AID = 'mutual_aid',
  COMMUNITY_ORG = 'community_org',
  SOCIAL_ENTERPRISE = 'social_enterprise',
  COLLECTIVE = 'collective',
  COMMONS = 'commons',
  CREDIT_UNION = 'credit_union',
  LAND_TRUST = 'land_trust',
  OTHER = 'other',
}

export const orgTypeEnum = pgEnum('org_type', enumToPgEnum(OrgType));

// An organization represents a tenant in the system
// Org profiles should maybe be separated from organizations?
export const organizations = pgTable(
  'organizations',
  {
    id: autoId().primaryKey(),
    name: varchar({ length: 256 }).notNull(),
    slug: varchar({ length: 256 }).notNull().unique(),
    description: varchar({ length: 256 }),

    // Mission
    mission: text(),
    // Year Founded
    yearFounded: integer(),
    values: text().array(),
    // Email
    email: varchar({ length: 255 }),
    phone: varchar({ length: 50 }),
    website: varchar({ length: 255 }),
    // Address
    address: varchar({ length: 255 }),
    city: varchar({ length: 100 }),
    state: varchar({ length: 50 }),
    postalCode: varchar({ length: 20 }),
    // Geography
    latitude: decimal(),
    longitude: decimal(),
    isVerified: boolean().default(false),
    socialLinks: json(), // Store social media links

    isOfferingFunds: boolean().default(false),
    isReceivingFunds: boolean().default(false),

    // Organization Type
    type: orgTypeEnum('org_type').notNull().default(OrgType.OTHER),
    // Legal Structure
    // Thematic Areas
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.slug).concurrently(),
    index('organizations_name_gin_index')
      .using('gin', sql`to_tsvector('english', ${table.name})`)
      .concurrently(),
  ],
);

export const organizationsRelations = relations(organizations, ({ many }) => ({
  projects: many(projects),
  fundingLinks: many(fundingLinks),
}));

enum LinkType {
  OFFERING = 'offering',
  RECEIVING = 'receiving',
}

export const linkTypeEnum = pgEnum('link_type', enumToPgEnum(LinkType));

export const fundingLinks = pgTable(
  'funding_links',
  {
    id: autoId().primaryKey(),
    name: varchar({ length: 256 }),
    href: varchar({ length: 256 }).notNull(),
    type: linkTypeEnum('link_type').notNull().default(LinkType.OFFERING),
    organizationId: uuid().references(() => organizations.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
  },
  (table) => [...serviceRolePolicies, index().on(table.id).concurrently()],
);

export const fundingLinksRelations = relations(fundingLinks, ({ one }) => ({
  organization: one(organizations, {
    fields: [fundingLinks.organizationId],
    references: [organizations.id],
  }),
}));
