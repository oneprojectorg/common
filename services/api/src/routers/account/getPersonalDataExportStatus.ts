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

      // Registered before the read: the run can finish while this is in flight.
      ctx.registerQueryChannels([Channels.personalDataExport(input.exportId)]);

      return await getPersonalDataExportStatus({
        exportId: input.exportId,
        user,
      });
    }),
});
