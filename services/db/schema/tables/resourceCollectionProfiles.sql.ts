import { InferModel, sql } from 'drizzle-orm';
import {
  index,
  integer,
  pgTable,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { profileUsers } from './profileUsers.sql';
import { profiles } from './profiles.sql';
import { resourceCollections } from './resourceCollections.sql';

export const resourceCollectionProfiles = pgTable(
  'resource_collection_profiles',
  {
    id: autoId().primaryKey(),
    collectionId: uuid()
      .notNull()
      .references(() => resourceCollections.id, { onDelete: 'cascade' }),
    profileId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    sortOrder: integer().notNull().default(0),
    addedByProfileUserId: uuid().references(() => profileUsers.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    uniqueIndex('resource_collection_profiles_order_idx')
      .on(table.profileId, table.sortOrder)
      .where(sql`${table.deletedAt} IS NULL`),
    index('resource_collection_profiles_collection_idx').on(table.collectionId),
    index('resource_collection_profiles_added_by_idx').on(
      table.addedByProfileUserId,
    ),
    uniqueIndex('resource_collection_profiles_unq')
      .on(table.profileId, table.collectionId)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

export type ResourceCollectionProfile = InferModel<
  typeof resourceCollectionProfiles
>;
