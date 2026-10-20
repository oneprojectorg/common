import { type SQL, db, eq, sql } from '@op/db/client';
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

const allChannelsOn = (): ChannelPreferences => ({ email: true, sms: true });

const byCategory = <T>(
  make: (category: NotificationCategory) => T,
): Record<NotificationCategory, T> => ({
  proposalsAndComments: make('proposalsAndComments'),
  thingsYouFollow: make('thingsYouFollow'),
  processUpdates: make('processUpdates'),
  relationshipRequests: make('relationshipRequests'),
});

export const resolveNotificationPreferences = (
  stored: StoredNotificationPreferences | null | undefined,
): NotificationPreferences =>
  byCategory((category) => ({ ...allChannelsOn(), ...stored?.[category] }));

const mergeIntoStored = (patch: NotificationPreferencesPatch): SQL =>
  NOTIFICATION_CATEGORIES.reduce<SQL>(
    (merged, category) => {
      const channels = Object.fromEntries(
        Object.entries(patch[category] ?? {}).filter(
          ([, enabled]) => typeof enabled === 'boolean',
        ),
      );
      if (Object.keys(channels).length === 0) {
        return merged;
      }
      return sql`${merged} || jsonb_build_object(${category}::text, coalesce(${users.notificationPreferences} -> ${category}::text, '{}'::jsonb) || ${JSON.stringify(channels)}::jsonb)`;
    },
    sql`coalesce(${users.notificationPreferences}, '{}'::jsonb)`,
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
  const [updated] = await db
    .update(users)
    .set({ notificationPreferences: mergeIntoStored(patch) })
    .where(eq(users.authUserId, authUserId))
    .returning({ notificationPreferences: users.notificationPreferences });

  if (!updated) {
    throw new NotFoundError('User not found');
  }

  return resolveNotificationPreferences(updated.notificationPreferences);
};
