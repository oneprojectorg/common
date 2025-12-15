import { relations } from 'drizzle-orm';
import type { InferModel } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { profiles } from './profiles.sql';

export const modules = pgTable(
  'modules',
  {
    id: autoId().primaryKey(),
    slug: varchar({ length: 100 }).notNull().unique(),
    name: varchar({ length: 256 }).notNull(),
    description: text(),
    isActive: boolean().notNull().default(true),
    metadata: jsonb('metadata'),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.slug).concurrently(),
    index().on(table.isActive).concurrently(),
  ],
);

export const profileModules = pgTable(
  'profile_modules',
  {
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => modules.id, { onDelete: 'cascade' }),
    enabledAt: timestamp().notNull().defaultNow(),
    enabledBy: uuid('enabled_by'),
    config: jsonb('config'),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    primaryKey({ columns: [table.profileId, table.moduleId] }),
    index().on(table.profileId).concurrently(),
    index().on(table.moduleId).concurrently(),
    index().on(table.enabledAt).concurrently(),
  ],
);

export const modulesRelations = relations(modules, ({ many }) => ({
  profileModules: many(profileModules),
}));

export const profileModulesRelations = relations(profileModules, ({ one }) => ({
  profile: one(profiles, {
    fields: [profileModules.profileId],
    references: [profiles.id],
  }),
  module: one(modules, {
    fields: [profileModules.moduleId],
    references: [modules.id],
  }),
}));

export type Module = InferModel<typeof modules>;
export type ProfileModule = InferModel<typeof profileModules>;
