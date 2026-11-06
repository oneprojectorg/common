import { Channels, listReviewReminderRecipients } from '@op/common';
import {
  reviewReminderRecipientsInputSchema,
  reviewReminderRecipientsSchema,
} from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const listReviewReminderRecipientsRouter = router({
  listReviewReminderRecipients: networkAuthenticatedProcedure()
    .input(reviewReminderRecipientsInputSchema)
    .output(reviewReminderRecipientsSchema)
    .query(async ({ ctx, input }) => {
      ctx.registerQueryChannels([
        Channels.reviewAssignments(input.processInstanceId),
      ]);

      return await listReviewReminderRecipients({
        ...input,
        user: ctx.user,
      });
    }),
});
