import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { relations } from 'drizzle-orm/_relations';
import { index, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';

import {
  autoId,
  serviceRolePolicies,
  timestamps,
  tsvector,
} from '../../helpers';
import { EntityType, entityTypeEnum } from './entities.sql';
import { individuals } from './individuals.sql';
import { profileModules } from './modules.sql';
import { organizations } from './organizations.sql';
import { posts } from './posts.sql';
import { processInstances } from './processInstances.sql';
import { profileUsers } from './profileUsers.sql';
import { objectsInStorage } from './storage.sql';

export const profiles = pgTable(
  'profiles',
  {
    id: autoId().primaryKey(),
    type: entityTypeEnum('entity_type').notNull().default(EntityType.ORG),
    name: varchar({ length: 256 }).notNull(),
    slug: varchar({ length: 256 }).notNull().unique(),
    bio: text(),

    // Mission
    mission: text(),

    // Email
    email: varchar({ length: 255 }),
    phone: varchar({ length: 50 }),
    website: varchar({ length: 255 }),

    address: varchar({ length: 255 }),
    city: varchar({ length: 100 }),
    state: varchar({ length: 50 }),
    postalCode: varchar({ length: 20 }),

    // Media items
    headerImageId: uuid().references(() => objectsInStorage.id, {
      onUpdate: 'cascade',
    }),
    avatarImageId: uuid().references(() => objectsInStorage.id, {
      onUpdate: 'cascade',
    }),

    search: tsvector('search').generatedAlwaysAs(
      (): SQL =>
        sql`setweight(to_tsvector('simple', ${profiles.name}), 'A') || ' ' || setweight(to_tsvector('english', COALESCE(${profiles.bio}, '')), 'B') || ' ' || setweight(to_tsvector('english', COALESCE(${profiles.mission}, '')), 'C')::tsvector`,
    ),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.slug).concurrently(),
    index().on(table.headerImageId),
    index().on(table.avatarImageId),
    index().on(table.updatedAt).concurrently(),
    index('profiles_search_gin_index').using('gin', table.search),
    index('profiles_name_trgm_idx')
      .using('gin', sql`${table.name} extensions.gin_trgm_ops`)
      .concurrently(),
  ],
);

export const profilesRelations = relations(profiles, ({ many, one }) => ({
  posts: many(posts), // Posts authored by this profile
  headerImage: one(objectsInStorage, {
    fields: [profiles.headerImageId],
    references: [objectsInStorage.id],
  }),
  avatarImage: one(objectsInStorage, {
    fields: [profiles.avatarImageId],
    references: [objectsInStorage.id],
  }),
  organization: one(organizations, {
    fields: [profiles.id],
    references: [organizations.profileId],
  }),
  individual: one(individuals, {
    fields: [profiles.id],
    references: [individuals.profileId],
  }),
  processInstance: one(processInstances, {
    fields: [profiles.id],
    references: [processInstances.profileId],
  }),
  modules: many(profileModules),
  profileUsers: many(profileUsers),
}));

export type Profile = typeof profiles.$inferSelect;
