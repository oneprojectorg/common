import { db } from '@op/db/client';
import { notifications } from '@op/db/schema';
import type { NotificationCategory } from '@op/db/schema';

export interface FanOutNotificationsInput {
  activityId: string;
  authUserIds: string[];
  category: NotificationCategory;
  actionRequired?: boolean;
}

export const fanOutNotifications = async ({
  activityId,
  authUserIds,
  category,
  actionRequired = false,
}: FanOutNotificationsInput): Promise<{ inserted: number }> => {
  const unique = [...new Set(authUserIds)];

  if (unique.length === 0) {
    return { inserted: 0 };
  }

  const rows = await db
    .insert(notifications)
    .values(
      unique.map((authUserId) => ({
        activityId,
        authUserId,
        category,
        actionRequired,
      })),
    )
    .onConflictDoNothing({
      target: [notifications.activityId, notifications.authUserId],
    })
    .returning({ id: notifications.id });

  return { inserted: rows.length };
};
