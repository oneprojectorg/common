import { InferModel, sql } from 'drizzle-orm';
import { index, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { asciiText, autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { profileUsers } from './profileUsers.sql';
import { resourceCollections } from './resourceCollections.sql';
import { resources } from './resources.sql';

export const resourceCollectionItems = pgTable(
  'resource_collection_items',
  {
    id: autoId().primaryKey(),
    collectionId: uuid()
      .notNull()
      .references(() => resourceCollections.id, { onDelete: 'cascade' }),
    resourceId: uuid()
      .notNull()
      .references(() => resources.id, { onDelete: 'cascade' }),
    sortKey: asciiText().notNull(),
    addedByProfileUserId: uuid().references(() => profileUsers.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    uniqueIndex('resource_collection_items_order_idx')
      .on(table.collectionId, table.sortKey)
      .where(sql`${table.deletedAt} IS NULL`),
    index('resource_collection_items_resource_idx').on(table.resourceId),
    index('resource_collection_items_added_by_idx').on(
      table.addedByProfileUserId,
    ),
    uniqueIndex('resource_collection_items_unq')
      .on(table.collectionId, table.resourceId)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

export type ResourceCollectionItem = InferModel<typeof resourceCollectionItems>;
