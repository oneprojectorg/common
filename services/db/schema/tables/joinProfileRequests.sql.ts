import { relations } from 'drizzle-orm';
import { index, pgEnum, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import {
  autoId,
  enumToPgEnum,
  serviceRolePolicies,
  timestamps,
} from '../../helpers';
import { profiles } from './profiles.sql';

export enum JoinProfileRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export const joinProfileRequestsStatusEnum = pgEnum(
  'join_profile_request_status',
  enumToPgEnum(JoinProfileRequestStatus),
);

// Store requests to join profiles from other profiles
export const joinProfileRequests = pgTable(
  'joinProfileRequests',
  {
    id: autoId().primaryKey(),
    requestProfileId: uuid('request_profile_id')
      .notNull()
      .references(() => profiles.id, {
        onDelete: 'cascade',
      }),
    targetProfileId: uuid('target_profile_id')
      .notNull()
      .references(() => profiles.id, {
        onDelete: 'cascade',
      }),
    status: joinProfileRequestsStatusEnum('status')
      .default(JoinProfileRequestStatus.PENDING)
      .notNull(),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.requestProfileId),
    index().on(table.targetProfileId),
    uniqueIndex('requestToTarget_idx').on(
      table.requestProfileId,
      table.targetProfileId,
    ),
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

export type JoinProfileRequest = typeof joinProfileRequests.$inferSelect;
