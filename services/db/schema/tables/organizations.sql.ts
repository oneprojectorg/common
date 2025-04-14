import { sql } from 'drizzle-orm';
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

import { serviceRolePolicies } from '../../helpers/policies';
import { timestamps } from '../../helpers/timestamps';

// Enums for organization types and status
const orgTypeEnum = pgEnum('org_type', [
  'cooperative',
  'mutual_aid',
  'community_org',
  'social_enterprise',
  'collective',
  'commons',
  'credit_union',
  'land_trust',
  'other',
]);

export const organizations = pgTable(
  'organizations',
  {
    id: uuid().primaryKey().notNull(),
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
    city: varchar({ length: 100 }).notNull(),
    state: varchar({ length: 50 }).notNull(),
    postalCode: varchar({ length: 20 }),
    // Geography
    latitude: decimal(),
    longitude: decimal(),
    isVerified: boolean().default(false),
    socialLinks: json(), // Store social media links

    // Organization Type
    type: orgTypeEnum().notNull().default('other'),
    // Thematic Areas
    // Legal Structure
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.slug).concurrently(),
    index('organizations_name_gin_index')
      .using('gin', sql`to_tsvector('english', ${table.name})`)
      .concurrently(),
    index('organizations_values_gin_index')
      .using('gin', sql`to_tsvector('english', ${table.values})`)
      .concurrently(),
  ],
);
