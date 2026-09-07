import { requestPersonalDataExport } from '@op/common';
import { z } from 'zod';

import { authenticatedConfirmedProcedure, router } from '../../trpcFactory';

const exportPersonalDataOutputSchema = z.object({
  exportId: z.string().uuid(),
});

export const exportPersonalDataRouter = router({
  // No input. The data subject is the caller, so an id here would be the one way
  // this endpoint could hand one person another person's record.
  //
  // `authenticatedConfirmedProcedure`, not the network tier: Article 20 belongs
  // to the account holder rather than to a member of our closed network, and the
  // service reads nothing but the caller's own rows. It is still above
  // `authenticatedProcedure`, which admits anonymous sessions — an anonymous
  // sign-in is not a data subject with a record to export.
  //
  // Tighter than the default 10-per-10-seconds. Each accepted request queues a
  // job that reads the caller's whole record across nine tables and writes a
  // file, which is the most expensive thing an ordinary account can ask for
  // here. Nobody exercising this right needs a second copy within the minute,
  // and the status query — not a repeat mutation — is how a client follows a run
  // it already started.
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
