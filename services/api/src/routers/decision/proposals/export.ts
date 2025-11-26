import { UnauthorizedError, exportProposals } from '@op/common';
import { ProposalStatus } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import withAnalytics from '../../../middlewares/withAnalytics';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import { loggedProcedure, router } from '../../../trpcFactory';

const exportInputSchema = z.object({
  processInstanceId: z.string().uuid(),
  format: z.enum(['csv']).default('csv'),
  categoryId: z.string().optional(),
  submittedByProfileId: z.string().optional(),
  status: z.enum(ProposalStatus).optional(),
  dir: z.enum(['asc', 'desc']).default('desc'),
  proposalFilter: z.enum(['all', 'my', 'shortlisted', 'my-ballot']).optional(),
});

const exportOutputSchema = z.object({
  exportId: z.string().uuid(),
});

export const exportProposalsRouter = router({
  export: loggedProcedure
    .use(withAuthenticated)
    .use(withAnalytics)
    .input(exportInputSchema)
    .output(exportOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      try {
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
      } catch (error: unknown) {
        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: error.message,
            code: 'FORBIDDEN',
          });
        }

        if (error instanceof TRPCError) {
          throw error;
        }

        logger.error('Failed to create export job', {
          userId: user.id,
          input,
          error,
        });

        throw new TRPCError({
          message: 'Failed to create export job',
          code: 'INTERNAL_SERVER_ERROR',
          cause: error,
        });
      }
    }),
});
