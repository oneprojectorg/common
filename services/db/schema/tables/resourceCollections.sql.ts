import { InferModel } from 'drizzle-orm';
import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { profileUsers } from './profileUsers.sql';

export const resourceCollections = pgTable(
  'resource_collections',
  {
    id: autoId().primaryKey(),
    name: text().notNull(),
    addedByProfileUserId: uuid().references(() => profileUsers.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index('resource_collections_added_by_idx').on(table.addedByProfileUserId),
  ],
);

export type ResourceCollection = InferModel<typeof resourceCollections>;
