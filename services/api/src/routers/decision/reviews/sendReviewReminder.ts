import { sendReviewReminder } from '@op/common';
import {
  sendReviewReminderInputSchema,
  sendReviewReminderResultSchema,
} from '@op/common/client';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

export const sendReviewReminderRouter = router({
  sendReviewReminder: networkAuthenticatedProcedure()
    .input(sendReviewReminderInputSchema)
    .output(sendReviewReminderResultSchema)
    .mutation(async ({ ctx, input }) =>
      sendReviewReminder({ ...input, user: ctx.user }),
    ),
});
