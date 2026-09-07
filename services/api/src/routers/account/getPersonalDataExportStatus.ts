import {
  getPersonalDataExportStatus,
  personalDataExportResponseSchema,
} from '@op/common';
import { Channels } from '@op/common/realtime';
import { z } from 'zod';

import { authenticatedConfirmedProcedure, router } from '../../trpcFactory';

const personalDataExportStatusInputSchema = z.object({
  exportId: z.string().uuid(),
});

export const getPersonalDataExportStatusRouter = router({
  getPersonalDataExportStatus: authenticatedConfirmedProcedure()
    .input(personalDataExportStatusInputSchema)
    .output(personalDataExportResponseSchema)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;

      // The export workflow broadcasts here when the run starts and when it
      // finishes, so a completed file surfaces without the client having to ask
      // again. Registered before the read: the run can finish while this is in
      // flight, and a channel attached to the response the client is already
      // waiting on is one it will subscribe to either way.
      ctx.registerQueryChannels([Channels.personalDataExport(input.exportId)]);

      return await getPersonalDataExportStatus({
        exportId: input.exportId,
        user,
      });
    }),
});
