import { db } from '@op/db/client';
import { notifications } from '@op/db/schema';
import { and, count, eq, inArray, isNull, sql } from 'drizzle-orm';

const READ_NOW = {
  readAt: sql`(now() AT TIME ZONE 'utc'::text)`,
  seenAt: sql`coalesce(${notifications.seenAt}, (now() AT TIME ZONE 'utc'::text))`,
};

export const getUnreadNotificationCount = async ({
  authUserId,
}: {
  authUserId: string;
}): Promise<number> => {
  const [row] = await db
    .select({ count: count() })
    .from(notifications)
    .where(
      and(eq(notifications.userId, authUserId), isNull(notifications.readAt)),
    );

  return row?.count ?? 0;
};

export const markNotificationsRead = async ({
  authUserId,
  notificationIds,
}: {
  authUserId: string;
  notificationIds: string[];
}): Promise<{ updated: number }> => {
  if (notificationIds.length === 0) {
    return { updated: 0 };
  }

  const rows = await db
    .update(notifications)
    .set(READ_NOW)
    .where(
      and(
        eq(notifications.userId, authUserId),
        inArray(notifications.id, notificationIds),
        isNull(notifications.readAt),
      ),
    )
    .returning({ id: notifications.id });

  return { updated: rows.length };
};

export const markAllNotificationsRead = async ({
  authUserId,
}: {
  authUserId: string;
}): Promise<{ updated: number }> => {
  const rows = await db
    .update(notifications)
    .set(READ_NOW)
    .where(
      and(eq(notifications.userId, authUserId), isNull(notifications.readAt)),
    )
    .returning({ id: notifications.id });

  return { updated: rows.length };
};
