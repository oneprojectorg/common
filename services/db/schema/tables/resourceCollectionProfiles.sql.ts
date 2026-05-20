import { InferModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm/_relations';
import { index, integer, pgTable, unique, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { profiles } from './profiles.sql';
import { profileUsers } from './profileUsers.sql';
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
    index('resource_collection_profiles_order_idx').on(
      table.profileId,
      table.sortOrder,
    ),
    unique('resource_collection_profiles_unq').on(
      table.profileId,
      table.collectionId,
    ),
  ],
);

export const resourceCollectionProfilesRelations = relations(
  resourceCollectionProfiles,
  ({ one }) => ({
    collection: one(resourceCollections, {
      fields: [resourceCollectionProfiles.collectionId],
      references: [resourceCollections.id],
    }),
    profile: one(profiles, {
      fields: [resourceCollectionProfiles.profileId],
      references: [profiles.id],
    }),
    addedBy: one(profileUsers, {
      fields: [resourceCollectionProfiles.addedByProfileUserId],
      references: [profileUsers.id],
    }),
  }),
);

export type ResourceCollectionProfile = InferModel<
  typeof resourceCollectionProfiles
>;
