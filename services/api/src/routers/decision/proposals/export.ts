import { exportProposals } from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';

// No filters: what an export covers is fixed by the job — every non-draft
// proposal in the instance's current phase — rather than by whatever the
// requester happened to have on screen.
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
