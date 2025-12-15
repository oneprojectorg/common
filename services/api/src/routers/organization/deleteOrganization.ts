import { deleteOrganization } from '@op/common';
import { logger } from '@op/logging';
import { createSBServiceClient } from '@op/supabase/server';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import withAnalytics from '../../middlewares/withAnalytics';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  organizationId: z.uuid(),
});

const outputSchema = z.object({
  success: z.boolean(),
  deletedId: z.string(),
  deletedProfileId: z.string(),
});

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'DELETE',
    path: '/organization/{organizationId}',
    protect: true,
    tags: ['organization'],
    summary: 'Delete an organization',
    description:
      'Permanently deletes an organization and all associated data. Requires admin permission. Cannot delete organizations with active decision processes.',
  },
};

/**
 * Cleans up storage objects (avatar/banner images) after organization deletion.
 * Runs as a best-effort cleanup - errors are logged but don't fail the operation.
 */
async function cleanupStorageObjects(
  storageObjectsToDelete: Array<{ bucket: string; path: string }>,
) {
  if (storageObjectsToDelete.length === 0) {
    return;
  }

  try {
    const supabase = createSBServiceClient();

    // Group by bucket for efficient deletion
    const byBucket = storageObjectsToDelete.reduce<Record<string, string[]>>(
      (acc, obj) => {
        const paths = acc[obj.bucket] ?? [];
        paths.push(obj.path);
        acc[obj.bucket] = paths;
        return acc;
      },
      {},
    );

    // Delete from each bucket
    await Promise.all(
      Object.entries(byBucket).map(async ([bucket, paths]) => {
        const { error } = await supabase.storage.from(bucket).remove(paths);
        if (error) {
          logger.warn('Failed to delete storage objects', {
            bucket,
            paths,
            error: error.message,
          });
        }
      }),
    );
  } catch (error) {
    // Log but don't fail - the org is already deleted
    logger.warn('Storage cleanup failed', { error });
  }
}

export const deleteOrganizationRouter = router({
  deleteOrganization: loggedProcedure
    .use(withRateLimited({ windowSize: 60, maxRequests: 3 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(inputSchema)
    .output(outputSchema)
    .mutation(async ({ ctx, input }) => {
      const { organizationId } = input;
      const { user } = ctx;

      try {
        const result = await deleteOrganization({
          organizationId,
          user,
        });

        // Clean up storage objects (best-effort, non-blocking)
        cleanupStorageObjects(result.storageObjectsToDelete).catch((err) => {
          logger.warn('Async storage cleanup failed', { error: err });
        });

        return outputSchema.parse({
          success: result.success,
          deletedId: result.deletedId,
          deletedProfileId: result.deletedProfileId,
        });
      } catch (error: unknown) {
        logger.error('Error deleting organization', { error, organizationId });

        if (error instanceof Error) {
          if (error.name === 'UnauthorizedError') {
            throw new TRPCError({
              message: error.message,
              code: 'UNAUTHORIZED',
            });
          }
          if (error.name === 'NotFoundError') {
            throw new TRPCError({
              message: error.message,
              code: 'NOT_FOUND',
            });
          }
          if (error.name === 'ValidationError') {
            throw new TRPCError({
              message: error.message,
              code: 'BAD_REQUEST',
            });
          }
          if (error.name === 'AccessError') {
            throw new TRPCError({
              message: 'You do not have permission to delete this organization',
              code: 'UNAUTHORIZED',
            });
          }
        }

        throw new TRPCError({
          message: 'Failed to delete organization',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
