import { relations } from 'drizzle-orm';
import { index, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

import { serviceRolePolicies } from '../../helpers/policies';
import { timestamps } from '../../helpers/timestamps';

import { organizations } from './organizations.sql';

export const projects = pgTable(
  'projects',
  {
    id: uuid().primaryKey().notNull(),
    name: varchar({ length: 256 }).notNull(),
    slug: varchar({ length: 256 }).notNull().unique(),
    description: varchar({ length: 256 }),
    organizationId: uuid().references(() => organizations.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    ...timestamps,
  },
  table => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.slug).concurrently(),
  ],
);

export const projectsRelations = relations(projects, ({ one }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
}));
