import { InferModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm/_relations';
import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { profileUsers } from './profileUsers.sql';
import { resourceCollectionItems } from './resourceCollectionItems.sql';
import { resourceCollectionProfiles } from './resourceCollectionProfiles.sql';

export const resourceCollections = pgTable(
  'resource_collections',
  {
    id: autoId().primaryKey(),
    name: text().notNull(),
    createdByProfileUserId: uuid().references(() => profileUsers.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index('resource_collections_created_by_idx').on(
      table.createdByProfileUserId,
    ),
  ],
);

export const resourceCollectionsRelations = relations(
  resourceCollections,
  ({ many, one }) => ({
    items: many(resourceCollectionItems),
    profiles: many(resourceCollectionProfiles),
    createdBy: one(profileUsers, {
      fields: [resourceCollections.createdByProfileUserId],
      references: [profileUsers.id],
    }),
  }),
);

export type ResourceCollection = InferModel<typeof resourceCollections>;
