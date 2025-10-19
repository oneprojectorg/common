import { set } from '@op/cache';
import { exportProposals, UnauthorizedError } from '@op/common';
import { event, Events } from '@op/events';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAnalytics from '../../../middlewares/withAnalytics';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import { loggedProcedure, router } from '../../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'POST',
    path: '/decision/proposals/export',
    protect: true,
    tags: ['decision'],
    summary: 'Export proposals to a file format (CSV, etc.)',
  },
};

const exportInputSchema = z.object({
  processInstanceId: z.string().uuid(),
  format: z.enum(['csv']).default('csv'),
  categoryId: z.string().optional(),
  submittedByProfileId: z.string().optional(),
  status: z
    .enum(['draft', 'submitted', 'under_review', 'approved', 'rejected'])
    .optional(),
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
    .meta(meta)
    .input(exportInputSchema)
    .output(exportOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      try {
        // Service handles all authorization checks
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

        // Set initial 'pending' status in cache so frontend can poll immediately
        const cacheKey = `export:proposal:${exportId}`;
        await set(
          cacheKey,
          {
            exportId,
            processInstanceId: input.processInstanceId,
            userId: user.id,
            format: input.format,
            status: 'pending',
            filters: {
              categoryId: input.categoryId,
              submittedByProfileId: input.submittedByProfileId,
              status: input.status,
              dir: input.dir,
              proposalFilter: input.proposalFilter,
            },
            createdAt: new Date().toISOString(),
          },
          24 * 60 * 60, // 24 hours TTL
        );

        // Send Inngest event to trigger export workflow
        await event.send({
          name: Events.proposalExportRequested.name,
          data: {
            exportId,
            processInstanceId: input.processInstanceId,
            userId: user.id,
            format: input.format,
            filters: {
              categoryId: input.categoryId,
              submittedByProfileId: input.submittedByProfileId,
              status: input.status,
              dir: input.dir,
              proposalFilter: input.proposalFilter,
            },
          },
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
