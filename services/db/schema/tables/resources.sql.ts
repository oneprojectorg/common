import { InferModel, sql } from 'drizzle-orm';
import { check, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { attachments } from './attachments.sql';
import { profileUsers } from './profileUsers.sql';

export const RESOURCE_TYPES = ['link', 'document'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const resources = pgTable(
  'resources',
  {
    id: autoId().primaryKey(),
    title: text().notNull(),
    description: text(),

    attachmentId: uuid().references(() => attachments.id, {
      onDelete: 'cascade',
    }),

    linkUrl: text(),

    type: text()
      .notNull()
      .generatedAlwaysAs(
        sql`CASE WHEN attachment_id IS NOT NULL THEN 'document' ELSE 'link' END`,
      ),

    addedByProfileUserId: uuid().references(() => profileUsers.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.attachmentId),
    index().on(table.addedByProfileUserId),
    check(
      'resources_payload_check',
      sql`((${table.attachmentId} IS NOT NULL) <> (${table.linkUrl} IS NOT NULL))`,
    ),
  ],
);

export type Resource = InferModel<typeof resources>;
