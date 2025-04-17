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

import { links } from './links.sql';
import { projects } from './projects.sql';
import { objectsInStorage } from './storage.sql';

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
  ],
);

export const organizationsRelations = relations(
  organizations,
  ({ many, one }) => ({
    projects: many(projects),
    links: many(links),
    posts: many(posts),
    headerImage: one(objectsInStorage, {
      fields: [organizations.headerImageId],
      references: [objectsInStorage.id],
    }),
    avatarImage: one(objectsInStorage, {
      fields: [organizations.avatarImageId],
      references: [objectsInStorage.id],
    }),
  }),
);

export const posts = pgTable(
  'posts',
  {
    id: autoId().primaryKey(),
    content: text().notNull(),
  },
  (table) => [...serviceRolePolicies, index().on(table.id).concurrently()],
);
