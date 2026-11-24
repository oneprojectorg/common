import { index, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { notifications } from './notifications.sql';

export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    id: autoId().primaryKey(),
    notificationId: uuid()
      .notNull()
      .references(() => notifications.id, {
        onDelete: 'cascade',
      }),
    channel: varchar({ length: 50 }).notNull(),
    providerMessageId: varchar({ length: 255 }),
    status: varchar({ length: 50 }).notNull(),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index('notification_deliveries_notification_id_idx').on(
      table.notificationId,
    ),
    // Provider webhooks key back by message id.
    index('notification_deliveries_provider_message_id_idx').on(
      table.providerMessageId,
    ),
  ],
);

export type NotificationDelivery = typeof notificationDeliveries.$inferSelect;
export type NewNotificationDelivery =
  typeof notificationDeliveries.$inferInsert;
