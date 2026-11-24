import { db } from '@op/db/client';
import {
  type Notification,
  notificationDeliveries,
  notifications,
} from '@op/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

export interface ListUndeliveredNotificationsInput {
  activityId: string;
  channel: string;
}

export const listUndeliveredNotifications = async ({
  activityId,
  channel,
}: ListUndeliveredNotificationsInput): Promise<Notification[]> => {
  const rows = await db
    .select({ notification: notifications })
    .from(notifications)
    .leftJoin(
      notificationDeliveries,
      and(
        eq(notificationDeliveries.notificationId, notifications.id),
        eq(notificationDeliveries.channel, channel),
      ),
    )
    .where(
      and(
        eq(notifications.activityId, activityId),
        isNull(notificationDeliveries.id),
      ),
    );

  return rows.map((row) => row.notification);
};

export interface NotificationDeliveryRecord {
  notificationId: string;
  channel: string;
  providerMessageId?: string | null;
  status: string;
}

export const recordNotificationDeliveries = async (
  rows: NotificationDeliveryRecord[],
): Promise<void> => {
  if (rows.length === 0) {
    return;
  }

  await db.insert(notificationDeliveries).values(rows);
};
