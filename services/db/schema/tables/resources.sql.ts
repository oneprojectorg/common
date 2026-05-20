import { InferModel, sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm/_relations';
import { check, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { attachments } from './attachments.sql';
import { profileUsers } from './profileUsers.sql';
import { resourceCollectionItems } from './resourceCollectionItems.sql';

export const RESOURCE_TYPES = ['link', 'document'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const resources = pgTable(
  'resources',
  {
    id: autoId().primaryKey(),
    title: text().notNull(),
    description: text(),

    attachmentId: uuid().references(() => attachments.id, {
      onDelete: 'restrict',
    }),

    linkUrl: text(),

    addedByProfileUserId: uuid().references(() => profileUsers.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.attachmentId),
    check(
      'resources_payload_check',
      sql`((${table.attachmentId} IS NOT NULL) <> (${table.linkUrl} IS NOT NULL))`,
    ),
  ],
);

export const resourcesRelations = relations(resources, ({ one, many }) => ({
  attachment: one(attachments, {
    fields: [resources.attachmentId],
    references: [attachments.id],
  }),
  addedBy: one(profileUsers, {
    fields: [resources.addedByProfileUserId],
    references: [profileUsers.id],
  }),
  collectionItems: many(resourceCollectionItems),
}));

export type Resource = InferModel<typeof resources>;
