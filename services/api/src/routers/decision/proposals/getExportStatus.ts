import { getExportStatus } from '@op/common';
import { Channels } from '@op/common/realtime';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

const exportStatusInputSchema = z.object({
  exportId: z.string().uuid(),
});

const exportStatusOutputSchema = z.union([
  z.object({
    status: z.literal('not_found'),
  }),
  z.object({
    exportId: z.string(),
    processInstanceId: z.string(),
    userId: z.string(),
    format: z.string(),
    status: z.enum(['pending', 'processing', 'completed', 'failed']),
    fileName: z.string().optional(),
    signedUrl: z.string().optional(),
    urlExpiresAt: z.string().optional(),
    errorMessage: z.string().optional(),
    createdAt: z.string(),
    completedAt: z.string().optional(),
  }),
]);

export const getExportStatusRouter = router({
  getExportStatus: networkAuthenticatedProcedure()
    .input(exportStatusInputSchema)
    .output(exportStatusOutputSchema)
    .query(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      // The export workflow broadcasts here when the run finishes, so a
      // completed file surfaces without the client having to ask again.
      // Registered before the read: the run can finish while this is in flight,
      // and a channel attached to the response the client is already waiting
      // on is one it will subscribe to either way.
      ctx.registerQueryChannels([Channels.proposalExport(input.exportId)]);

      return await getExportStatus({
        exportId: input.exportId,
        user,
        logger,
      });
    }),
});
