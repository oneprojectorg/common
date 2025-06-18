import { relations } from 'drizzle-orm';
import { index, jsonb, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { organizations } from './organizations.sql';

// A temporary table to allow only certain emails to login to the system
// Eventually this will be removed when we open to all
export const allowList = pgTable(
  'allowList',
  {
    id: autoId().primaryKey(),
    email: varchar({ length: 256 }).unique().notNull(),
    metadata: jsonb(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (table) => [...serviceRolePolicies, index().on(table.email).concurrently()],
);

export const allowListRelations = relations(allowList, ({ one }) => ({
  organization: one(organizations, {
    fields: [allowList.organizationId],
    references: [organizations.id],
  }),
}));
