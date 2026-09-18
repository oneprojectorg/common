import { requestPersonalDataExport } from '@op/common';
import { z } from 'zod';

import { authenticatedConfirmedProcedure, router } from '../../trpcFactory';

const exportPersonalDataOutputSchema = z.object({
  exportId: z.string().uuid(),
});

export const exportPersonalDataRouter = router({
  // No input: an id here would be the one way this endpoint could hand one
  // person another's record. The confirmed tier rather than the network one
  // because Article 20 belongs to the account holder, not to a member of our
  // closed network; the rate limit is tighter than the default because each
  // request queues a full nine-table read.
  exportPersonalData: authenticatedConfirmedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 3 },
  })
    .input(z.undefined())
    .output(exportPersonalDataOutputSchema)
    .mutation(async ({ ctx }) => {
      const { user, logger } = ctx;

      const { exportId } = await requestPersonalDataExport({ user });

      logger.info('Personal data export job created', {
        exportId,
        userId: user.id,
      });

      return { exportId };
    }),
});
