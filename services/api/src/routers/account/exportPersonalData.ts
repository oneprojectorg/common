import { requestPersonalDataExport } from '@op/common';
import { z } from 'zod';

import { authenticatedConfirmedProcedure, router } from '../../trpcFactory';

const exportPersonalDataOutputSchema = z.object({
  exportId: z.string().uuid(),
});

export const exportPersonalDataRouter = router({
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
