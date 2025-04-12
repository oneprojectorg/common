import {
  boolean,
  decimal,
  index,
  json,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { serviceRolePolicies } from '../../helpers/policies';
import { timestamps } from '../../helpers/timestamps';

export const organizations = pgTable(
  'organizations',
  {
    id: uuid().primaryKey().notNull(),
    name: varchar({ length: 256 }).notNull(),
    slug: varchar({ length: 256 }).notNull().unique(),
    description: varchar({ length: 256 }),

    mission: text(),
    values: text().array(),
    email: varchar({ length: 255 }),
    phone: varchar({ length: 50 }),
    website: varchar({ length: 255 }),
    address: varchar({ length: 255 }),
    city: varchar({ length: 100 }).notNull(),
    state: varchar({ length: 50 }).notNull(),
    postalCode: varchar({ length: 20 }),
    latitude: decimal(),
    longitude: decimal(),
    isVerified: boolean().default(false),
    socialLinks: json(), // Store social media links
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.slug).concurrently(),
  ],
);
