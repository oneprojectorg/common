import { exportProposals } from '@op/common';
import { ProposalFilter } from '@op/core';
import { ProposalStatus } from '@op/db/schema';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../../trpcFactory';

const exportInputSchema = z.object({
  processInstanceId: z.string().uuid(),
  format: z.enum(['csv']).default('csv'),
  categoryId: z.string().optional(),
  submittedByProfileId: z.string().optional(),
  status: z.enum(ProposalStatus).optional(),
  dir: z.enum(['asc', 'desc']).default('desc'),
  proposalFilter: z.enum(ProposalFilter).optional(),
});

const exportOutputSchema = z.object({
  exportId: z.string().uuid(),
});

export const exportProposalsRouter = router({
  export: commonAuthedProcedure()
    .input(exportInputSchema)
    .output(exportOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      const { exportId, organizationId } = await exportProposals({
        input: {
          processInstanceId: input.processInstanceId,
          format: input.format,
          categoryId: input.categoryId,
          submittedByProfileId: input.submittedByProfileId,
          status: input.status,
          dir: input.dir,
          proposalFilter: input.proposalFilter,
        },
        user,
      });

      logger.info('Export job created', {
        exportId,
        userId: user.id,
        processInstanceId: input.processInstanceId,
        format: input.format,
        organizationId,
      });

      return { exportId };
    }),
});
