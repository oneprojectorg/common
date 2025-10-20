import { UnauthorizedError, getExportStatus } from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAnalytics from '../../../middlewares/withAnalytics';
import withAuthenticated from '../../../middlewares/withAuthenticated';
import { loggedProcedure, router } from '../../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/decision/proposals/export/{exportId}',
    protect: true,
    tags: ['decision'],
    summary: 'Get the status of a proposal export job',
  },
};

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
    filters: z.any(),
    fileName: z.string().optional(),
    signedUrl: z.string().optional(),
    urlExpiresAt: z.string().optional(),
    errorMessage: z.string().optional(),
    createdAt: z.string(),
    completedAt: z.string().optional(),
  }),
]);

export const getExportStatusRouter = router({
  getExportStatus: loggedProcedure
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(exportStatusInputSchema)
    .output(exportStatusOutputSchema)
    .query(async ({ ctx, input }) => {
      const { user, logger } = ctx;

      try {
        const result = await getExportStatus({
          exportId: input.exportId,
          user,
          logger,
        });

        return result;
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

        logger.error('Failed to get export status', {
          userId: user.id,
          exportId: input.exportId,
          error,
        });

        throw new TRPCError({
          message: 'Failed to get export status',
          code: 'INTERNAL_SERVER_ERROR',
          cause: error,
        });
      }
    }),
});
