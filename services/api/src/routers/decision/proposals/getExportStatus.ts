import { getExportStatus } from '@op/common';
import { proposalExportFiltersSchema } from '@op/events';
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
    filters: proposalExportFiltersSchema,
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

      return await getExportStatus({
        exportId: input.exportId,
        user,
        logger,
      });
    }),
});
