import { notificationCategories } from '@op/db/schema';
import { z } from 'zod';

export const notificationActivityEncoder = z.object({
  id: z.string(),
  eventName: z.string(),
  actorProfileId: z.string().nullable(),
  organizationId: z.string().nullable(),
  processInstanceId: z.string().nullable(),
  proposalId: z.string().nullable(),
  postId: z.string().nullable(),
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
