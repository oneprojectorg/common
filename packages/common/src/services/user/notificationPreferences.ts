import { db, eq } from '@op/db/client';
import {
  type NotificationCategory,
  type NotificationChannel,
  type StoredNotificationPreferences,
  users,
} from '@op/db/schema';
import { z } from 'zod';

import { NotFoundError } from '../../utils/error';

export const NOTIFICATION_CATEGORIES = [
  'proposalsAndComments',
  'thingsYouFollow',
  'processUpdates',
  'relationshipRequests',
] as const satisfies ReadonlyArray<NotificationCategory>;

export const NOTIFICATION_CHANNELS = [
  'email',
  'sms',
] as const satisfies ReadonlyArray<NotificationChannel>;

export type ChannelPreferences = Record<NotificationChannel, boolean>;
export type NotificationPreferences = Record<
  NotificationCategory,
  ChannelPreferences
>;

const channelPatchSchema = z
  .object({ email: z.boolean(), sms: z.boolean() })
  .partial();

export const notificationPreferencesPatchSchema = z
  .object({
    proposalsAndComments: channelPatchSchema,
    thingsYouFollow: channelPatchSchema,
    processUpdates: channelPatchSchema,
    relationshipRequests: channelPatchSchema,
  })
  .partial();

export type NotificationPreferencesPatch = z.infer<
  typeof notificationPreferencesPatchSchema
>;

const allChannelsOn = (): ChannelPreferences =>
  Object.fromEntries(
    NOTIFICATION_CHANNELS.map((channel) => [channel, true]),
  ) as ChannelPreferences;

export const resolveNotificationPreferences = (
  stored: StoredNotificationPreferences | null | undefined,
): NotificationPreferences =>
  Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((category) => [
      category,
      { ...allChannelsOn(), ...stored?.[category] },
    ]),
  ) as NotificationPreferences;

export const mergeNotificationPreferences = (
  stored: StoredNotificationPreferences | null | undefined,
  patch: NotificationPreferencesPatch,
): StoredNotificationPreferences =>
  Object.fromEntries(
    NOTIFICATION_CATEGORIES.flatMap((category) => {
      const merged = { ...stored?.[category], ...patch[category] };
      return Object.keys(merged).length > 0 ? [[category, merged]] : [];
    }),
  );

export const getNotificationPreferences = async ({
  authUserId,
}: {
  authUserId: string;
}): Promise<NotificationPreferences> => {
  const [row] = await db
    .select({ notificationPreferences: users.notificationPreferences })
    .from(users)
    .where(eq(users.authUserId, authUserId))
    .limit(1);

  if (!row) {
    throw new NotFoundError('User not found');
  }

  return resolveNotificationPreferences(row.notificationPreferences);
};

export const updateNotificationPreferences = async ({
  authUserId,
  patch,
}: {
  authUserId: string;
  patch: NotificationPreferencesPatch;
}): Promise<NotificationPreferences> => {
  const [current] = await db
    .select({ notificationPreferences: users.notificationPreferences })
    .from(users)
    .where(eq(users.authUserId, authUserId))
    .limit(1);

  if (!current) {
    throw new NotFoundError('User not found');
  }

  const [updated] = await db
    .update(users)
    .set({
      notificationPreferences: mergeNotificationPreferences(
        current.notificationPreferences,
        patch,
      ),
    })
    .where(eq(users.authUserId, authUserId))
    .returning({ notificationPreferences: users.notificationPreferences });

  return resolveNotificationPreferences(updated?.notificationPreferences);
};
