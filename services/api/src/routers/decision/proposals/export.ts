import { exportProposals } from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

// An export covers the whole instance. It takes no filters, so the file a given
// instance produces is the same file whatever the requester was looking at.
const exportInputSchema = z.object({
  processInstanceId: z.string().uuid(),
  format: z.enum(['csv']).default('csv'),
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
