import { relations } from 'drizzle-orm';
import { index, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { profiles } from './profiles.sql';

// Store requests to join profiles from other profiles
export const joinProfileRequests = pgTable(
  'joinProfileRequests',
  {
    id: autoId().primaryKey(),
    requestProfileId: uuid('request_profile_id').references(() => profiles.id, {
      onDelete: 'cascade',
    }),
    targetProfileId: uuid('target_profile_id').references(() => profiles.id, {
      onDelete: 'cascade',
    }),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.requestProfileId).concurrently(),
    index().on(table.targetProfileId).concurrently(),
    uniqueIndex('requestToTarget_idx')
      .on(table.requestProfileId, table.targetProfileId)
      .concurrently(),
  ],
);

export const joinProfileRequestsRelations = relations(
  joinProfileRequests,
  ({ one }) => ({
    requestProfile: one(profiles, {
      fields: [joinProfileRequests.requestProfileId],
      references: [profiles.id],
    }),

    targetProfile: one(profiles, {
      fields: [joinProfileRequests.targetProfileId],
      references: [profiles.id],
    }),
  }),
);

export type JoinProfileRequests = typeof joinProfileRequests.$inferSelect;
