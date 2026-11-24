import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
} from '@op/common';
import { PAGE_LIMIT, paginated } from '@op/common/client';
import { z } from 'zod';

import { notificationEncoder } from '../../encoders/notifications';
import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

export const notificationsRouter = router({
  list: networkAuthenticatedProcedure()
    .input(
      z.object({
        limit: z.number().int().min(1).max(PAGE_LIMIT.max).optional(),
        cursor: z.string().nullish(),
      }),
    )
    .output(paginated(notificationEncoder))
    .query(async ({ ctx, input }) => {
      const { items, next } = await listNotifications({
        authUserId: ctx.user.id,
        limit: input.limit ?? PAGE_LIMIT.md,
        cursor: input.cursor,
      });

      return { items: items.map((item) => notificationEncoder.parse(item)), next };
    }),

  unreadCount: networkAuthenticatedProcedure()
    .output(z.object({ count: z.number().int() }))
    .query(async ({ ctx }) => ({
      count: await getUnreadNotificationCount({ authUserId: ctx.user.id }),
    })),

  markRead: networkAuthenticatedProcedure()
    .input(z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }))
    .output(z.object({ updated: z.number().int() }))
    .mutation(({ ctx, input }) =>
      markNotificationsRead({
        authUserId: ctx.user.id,
        notificationIds: input.ids,
      }),
    ),

  markAllRead: networkAuthenticatedProcedure()
    .output(z.object({ updated: z.number().int() }))
    .mutation(({ ctx }) =>
      markAllNotificationsRead({ authUserId: ctx.user.id }),
    ),
});
