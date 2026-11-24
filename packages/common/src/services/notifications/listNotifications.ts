import { db } from '@op/db/client';
import {
  type Activity,
  type Notification,
  activities,
  notifications,
} from '@op/db/schema';
import { and, desc, eq } from 'drizzle-orm';

import {
  PAGE_LIMIT,
  decodeCursor,
  encodeCursor,
  getGenericCursorCondition,
} from '../../utils';

export interface ListNotificationsInput {
  authUserId: string;
  limit?: number;
  cursor?: string | null;
}

export type NotificationListItem = Notification & { activity: Activity };

export const listNotifications = async ({
  authUserId,
  limit = PAGE_LIMIT.md,
  cursor,
}: ListNotificationsInput): Promise<{
  items: NotificationListItem[];
  next: string | null;
}> => {
  const decodedCursor = cursor ? decodeCursor(cursor) : undefined;

  const rows = await db
    .select({ notification: notifications, activity: activities })
    .from(notifications)
    .innerJoin(activities, eq(notifications.activityId, activities.id))
    .where(
      and(
        eq(notifications.userId, authUserId),
        decodedCursor
          ? getGenericCursorCondition({
              columns: { id: notifications.id, date: notifications.createdAt },
              cursor: decodedCursor,
            })
          : undefined,
      ),
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const next =
    rows.length > limit && last && last.notification.createdAt != null
      ? encodeCursor({
          date: new Date(last.notification.createdAt),
          id: last.notification.id,
        })
      : null;

  return {
    items: page.map(({ notification, activity }) => ({
      ...notification,
      activity,
    })),
    next,
  };
};
