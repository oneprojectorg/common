import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { activities } from './activities.sql';
import { authUsers } from './authUsers.sql';

export const notifications = pgTable(
  'notifications',
  {
    id: autoId().primaryKey(),
    activityId: uuid()
      .notNull()
      .references(() => activities.id, {
        onDelete: 'cascade',
      }),
    userId: uuid()
      .notNull()
      .references(() => authUsers.id, {
        onDelete: 'cascade',
      }),
    category: varchar({ length: 255 }).notNull(),
    actionRequired: boolean().default(false).notNull(),
    seenAt: timestamp({ withTimezone: true, mode: 'string' }),
    readAt: timestamp({ withTimezone: true, mode: 'string' }),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    // Replay-idempotent fan-out (ADR 0023).
    uniqueIndex('notifications_activity_id_user_id_idx').on(
      table.activityId,
      table.userId,
    ),
    // List: WHERE user_id = ? ORDER BY created_at DESC, id DESC.
    index('notifications_user_id_created_at_id_idx').on(
      table.userId,
      table.createdAt.desc().nullsFirst(),
      table.id.desc().nullsFirst(),
    ),
    // Unread badge.
    index('notifications_user_id_unread_idx')
      .on(table.userId)
      .where(sql`read_at IS NULL`),
    // Needs-action tab.
    index('notifications_user_id_needs_action_idx')
      .on(table.userId)
      .where(sql`action_required AND read_at IS NULL`),
  ],
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
