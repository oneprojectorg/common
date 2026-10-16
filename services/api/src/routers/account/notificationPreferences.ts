import {
  getNotificationPreferences as getNotificationPreferencesService,
  notificationPreferencesPatchSchema,
  updateNotificationPreferences as updateNotificationPreferencesService,
} from '@op/common';
import { z } from 'zod';

import { authenticatedConfirmedProcedure, router } from '../../trpcFactory';

const channelPreferencesEncoder = z.object({
  email: z.boolean(),
  sms: z.boolean(),
});

export const notificationPreferencesEncoder = z.object({
  proposalsAndComments: channelPreferencesEncoder,
  thingsYouFollow: channelPreferencesEncoder,
  processUpdates: channelPreferencesEncoder,
  relationshipRequests: channelPreferencesEncoder,
});

export const notificationPreferences = router({
  getNotificationPreferences: authenticatedConfirmedProcedure()
    .output(notificationPreferencesEncoder)
    .query(({ ctx }) =>
      getNotificationPreferencesService({ authUserId: ctx.user.id }),
    ),

  updateNotificationPreferences: authenticatedConfirmedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 10 },
  })
    .input(notificationPreferencesPatchSchema)
    .output(notificationPreferencesEncoder)
    .mutation(({ input, ctx }) =>
      updateNotificationPreferencesService({
        authUserId: ctx.user.id,
        patch: input,
      }),
    ),
});
