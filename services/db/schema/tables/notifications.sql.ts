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
import type { NotificationCategory } from './users.sql';

export const notifications = pgTable(
  'notifications',
  {
    id: autoId().primaryKey(),
    activityId: uuid()
      .notNull()
      .references(() => activities.id, {
        onDelete: 'cascade',
      }),
    authUserId: uuid()
      .notNull()
      .references(() => authUsers.id, {
        onDelete: 'cascade',
      }),
    category: varchar({ length: 255 }).$type<NotificationCategory>().notNull(),
    actionRequired: boolean().default(false).notNull(),
    seenAt: timestamp({ withTimezone: true, mode: 'string' }),
    readAt: timestamp({ withTimezone: true, mode: 'string' }),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    uniqueIndex('notifications_activity_id_auth_user_id_idx').on(
      table.activityId,
      table.authUserId,
    ),
    index('notifications_auth_user_id_created_at_id_idx').on(
      table.authUserId,
      table.createdAt.desc().nullsFirst(),
      table.id.desc().nullsFirst(),
    ),
    index('notifications_auth_user_id_unread_idx')
      .on(
        table.authUserId,
        table.createdAt.desc().nullsFirst(),
        table.id.desc().nullsFirst(),
      )
      .where(sql`read_at IS NULL`),
    index('notifications_auth_user_id_needs_action_idx')
      .on(
        table.authUserId,
        table.createdAt.desc().nullsFirst(),
        table.id.desc().nullsFirst(),
      )
      .where(sql`action_required AND read_at IS NULL`),
  ],
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
