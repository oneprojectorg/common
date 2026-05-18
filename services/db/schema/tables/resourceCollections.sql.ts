import { InferModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm/_relations';
import { pgTable, text } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { resourceCollectionItems } from './resourceCollectionItems.sql';
import { resourceCollectionProfiles } from './resourceCollectionProfiles.sql';

export const resourceCollections = pgTable(
  'resource_collections',
  {
    id: autoId().primaryKey(),
    name: text().notNull(),
    ...timestamps,
  },
  () => [...serviceRolePolicies],
);

export const resourceCollectionsRelations = relations(
  resourceCollections,
  ({ many }) => ({
    items: many(resourceCollectionItems),
    profiles: many(resourceCollectionProfiles),
  }),
);

export type ResourceCollection = InferModel<typeof resourceCollections>;
