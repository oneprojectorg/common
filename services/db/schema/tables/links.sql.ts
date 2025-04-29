import { relations } from 'drizzle-orm';
import {
  index,
  json,
  jsonb,
  pgEnum,
  pgTable,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  autoId,
  enumToPgEnum,
  serviceRolePolicies,
  timestamps,
} from '../../helpers';
import { organizations } from './organizations.sql';

export enum LinkType {
  OFFERING = 'offering',
  RECEIVING = 'receiving',
  WEBSITE = 'website',
  SOCIAL = 'social',
}

export const linkTypeEnum = pgEnum('link_type', enumToPgEnum(LinkType));

export const links = pgTable(
  'links',
  {
    id: autoId().primaryKey(),
    name: varchar({ length: 256 }),
    href: varchar({ length: 256 }).notNull(),
    type: linkTypeEnum('link_type').notNull().default(LinkType.OFFERING),
    metadata: jsonb(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    ...timestamps,
  },
  (table) => [...serviceRolePolicies, index().on(table.id).concurrently()],
);

export const linksRelations = relations(links, ({ one }) => ({
  organization: one(organizations, {
    fields: [links.organizationId],
    references: [organizations.id],
  }),
}));
