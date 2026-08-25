import { exportStatusResponseSchema, getExportStatus } from '@op/common';
import { Channels } from '@op/common/realtime';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

const exportStatusInputSchema = z.object({
  exportId: z.string().uuid(),
});

export const getExportStatusRouter = router({
  getExportStatus: networkAuthenticatedProcedure()
    .input(exportStatusInputSchema)
    .output(exportStatusResponseSchema)
    .query(async ({ ctx, input }) => {
      const { user } = ctx;

      // The export workflow broadcasts here when the run finishes, so a
      // completed file surfaces without the client having to ask again.
      // Registered before the read: the run can finish while this is in flight,
      // and a channel attached to the response the client is already waiting
      // on is one it will subscribe to either way.
      ctx.registerQueryChannels([Channels.proposalExport(input.exportId)]);

      return await getExportStatus({
        exportId: input.exportId,
        user,
      });
    }),
});
