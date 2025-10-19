import { get, set } from '@op/cache';
import { getExportStatus, UnauthorizedError } from '@op/common';
import type { ExportStatusData } from '@op/common';
import { createSBServerClient } from '@op/supabase/server';
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
        const key = `export:proposal:${input.exportId}`;
        const exportStatus = (await get(key)) as ExportStatusData | null;

        if (!exportStatus) {
          return { status: 'not_found' as const };
        }

        // Service handles all authorization checks (ownership + admin permission)
        await getExportStatus({
          exportData: exportStatus,
          user,
        });

        // Refresh signed URL if expired but file exists
        if (
          exportStatus.status === 'completed' &&
          exportStatus.signedUrl &&
          exportStatus.urlExpiresAt
        ) {
          const expiresAt = new Date(exportStatus.urlExpiresAt);

          if (expiresAt < new Date()) {
            logger.info('Refreshing expired signed URL', {
              exportId: input.exportId,
            });

            // Extract file path from the export status
            // We need to reconstruct it from the filename
            const filePath = `exports/proposals/${exportStatus.processInstanceId}/${exportStatus.fileName}`;

            const supabase = await createSBServerClient();
            const { data: urlData, error: urlError } = await supabase.storage
              .from('assets')
              .createSignedUrl(filePath, 60 * 60 * 24); // 24 hours

            if (!urlError && urlData) {
              exportStatus.signedUrl = urlData.signedUrl;
              exportStatus.urlExpiresAt = new Date(
                Date.now() + 24 * 60 * 60 * 1000,
              ).toISOString();

              // Update cache with new signed URL (24 hours TTL)
              await set(key, exportStatus, 24 * 60 * 60);
            }
          }
        }

        return exportStatus;
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
