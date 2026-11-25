import { notificationCategories } from '@op/db/schema';
import { z } from 'zod';

export const notificationActivityEncoder = z.object({
  id: z.string(),
  verb: z.string(),
  actorId: z.string().nullable(),
  objectType: z.string().nullable(),
  objectId: z.string().nullable(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  snapshot: z.unknown(),
  createdAt: z.string().nullable(),
});

export const notificationEncoder = z.object({
  id: z.string(),
  category: z.enum(notificationCategories),
  actionRequired: z.boolean(),
  seenAt: z.string().nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  activity: notificationActivityEncoder,
});

export type NotificationEncoded = z.infer<typeof notificationEncoder>;
