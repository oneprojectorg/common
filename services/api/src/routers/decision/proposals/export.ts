import { exportProposals } from '@op/common';
import { proposalExportFiltersSchema } from '@op/events';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

// Filters come from the shared export-filter schema so the request, the event
// payload, and the status response can't drift apart on what an export covers.
const exportInputSchema = proposalExportFiltersSchema.extend({
  processInstanceId: z.string().uuid(),
  format: z.enum(['csv']).default('csv'),
  dir: z.enum(['asc', 'desc']).default('desc'),
});

const exportOutputSchema = z.object({
  exportId: z.string().uuid(),
});

export const exportProposalsRouter = router({
  export: networkAuthenticatedProcedure()
    .input(exportInputSchema)
    .output(exportOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      const { exportId } = await exportProposals({
        input: {
          processInstanceId: input.processInstanceId,
          format: input.format,
          categoryId: input.categoryId,
          submittedByProfileId: input.submittedByProfileId,
          votedByProfileId: input.votedByProfileId,
          status: input.status,
          dir: input.dir,
          phase: input.phase,
          excludeAssignedForReview: input.excludeAssignedForReview,
        },
        user,
      });

      logger.info('Export job created', {
        exportId,
        userId: user.id,
        processInstanceId: input.processInstanceId,
        format: input.format,
      });

      return { exportId };
    }),
});
