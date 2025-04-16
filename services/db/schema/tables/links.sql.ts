import { index, pgEnum, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { autoId, enumToPgEnum, serviceRolePolicies } from '../../helpers';
import { organizations } from './organizations.sql';
import { relations } from 'drizzle-orm';

enum LinkType {
  OFFERING = 'offering',
  RECEIVING = 'receiving',
}

export const linkTypeEnum = pgEnum('link_type', enumToPgEnum(LinkType));

export const links = pgTable(
  'links',
  {
    id: autoId().primaryKey(),
    name: varchar({ length: 256 }),
    href: varchar({ length: 256 }).notNull(),
    type: linkTypeEnum('link_type').notNull().default(LinkType.OFFERING),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
  },
  (table) => [...serviceRolePolicies, index().on(table.id).concurrently()],
);

export const linksRelations = relations(links, ({ one }) => ({
  organization: one(organizations, {
    fields: [links.organizationId],
    references: [organizations.id],
  }),
}));
