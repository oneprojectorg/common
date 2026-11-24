import { db } from '@op/db/client';
import { notifications } from '@op/db/schema';

export interface FanOutNotificationsInput {
  activityId: string;
  userIds: string[];
  category: string;
  actionRequired?: boolean;
}

export const fanOutNotifications = async ({
  activityId,
  userIds,
  category,
  actionRequired = false,
}: FanOutNotificationsInput): Promise<{ inserted: number }> => {
  const unique = [...new Set(userIds)];

  if (unique.length === 0) {
    return { inserted: 0 };
  }

  const rows = await db
    .insert(notifications)
    .values(
      unique.map((userId) => ({
        activityId,
        userId,
        category,
        actionRequired,
      })),
    )
    .onConflictDoNothing({
      target: [notifications.activityId, notifications.userId],
    })
    .returning({ id: notifications.id });

  return { inserted: rows.length };
};
