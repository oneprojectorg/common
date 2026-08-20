import { get, set } from '@op/cache';
import { db, eq } from '@op/db/client';
import { processInstances } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { createSBServiceClient } from '@op/supabase/server';
import { permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { assertProfileAccess } from '../assert';
import {
  EXPORTS_BUCKET,
  EXPORT_CACHE_TTL_SECONDS,
  EXPORT_URL_TTL_SECONDS,
  exportFilePath,
  exportStatusCacheKey,
} from './exports';

export interface ExportStatusData {
  exportId: string;
  processInstanceId: string;
  userId: string;
  format: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fileName?: string;
  signedUrl?: string;
  urlExpiresAt?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export const getExportStatus = async ({
  exportId,
  user,
  logger,
}: {
  exportId: string;
  user: User;
  logger: {
    info: (message: string, meta?: any) => void;
    error: (message: string, meta?: any) => void;
  };
}): Promise<ExportStatusData | { status: 'not_found' }> => {
  // Get export data from cache
  const key = exportStatusCacheKey(exportId);
  const exportStatus = (await get(key)) as ExportStatusData | null;

  if (!exportStatus) {
    return { status: 'not_found' as const };
  }

  // Verify user owns this export (basic ownership check)
  if (exportStatus.userId !== user.id) {
    throw new UnauthorizedError('You do not have access to this export');
  }

  // Additionally verify user still has access to the decision profile
  const instance = await db
    .select({
      profileId: processInstances.profileId,
    })
    .from(processInstances)
    .where(eq(processInstances.id, exportStatus.processInstanceId))
    .limit(1);

  if (!instance[0]) {
    throw new NotFoundError('Process instance', exportStatus.processInstanceId);
  }

  if (!instance[0].profileId) {
    throw new NotFoundError('Decision profile', exportStatus.processInstanceId);
  }

  // Verify user has admin permission on the profile
  await assertProfileAccess({
    user,
    profileId: instance[0].profileId,
    permissions: [{ decisions: permission.ADMIN }],
  });

  // Signed URLs are shorter-lived than the export record, so a completed export
  // is re-signed on read once its current URL has lapsed.
  if (
    exportStatus.status === 'completed' &&
    exportStatus.fileName &&
    exportStatus.urlExpiresAt
  ) {
    const expiresAt = new Date(exportStatus.urlExpiresAt);

    if (expiresAt < new Date()) {
      logger.info('Refreshing expired signed URL', {
        exportId,
      });

      const filePath = exportFilePath(
        exportStatus.processInstanceId,
        exportStatus.fileName,
      );

      // Service-role client: `EXPORTS_BUCKET` is private and carries no
      // `storage.objects` policies, so a caller-scoped client cannot see the
      // object and its `createSignedUrl` fails. Signing here is safe because
      // everything this read has to authorize is already done above — the
      // record's own ownership check, then `assertProfileAccess` for
      // `decisions: ADMIN` on the owning profile.
      const supabase = createSBServiceClient();
      const { data: urlData, error: urlError } = await supabase.storage
        .from(EXPORTS_BUCKET)
        .createSignedUrl(filePath, EXPORT_URL_TTL_SECONDS);

      if (urlError || !urlData) {
        // A signature is the only way to read a private export, so a failed
        // refresh means there is no usable link — and this used to be swallowed,
        // leaving the lapsed URL on the record for the client to render as a
        // download that 400s. Report it and drop the URL instead: the button
        // falls back to its retryable state, and the cached record is left
        // untouched so the next read tries again rather than persisting the
        // failure.
        logger.error('Failed to refresh export signed URL', {
          error: urlError,
          exportId,
        });

        return { ...exportStatus, signedUrl: undefined };
      }

      exportStatus.signedUrl = urlData.signedUrl;
      exportStatus.urlExpiresAt = new Date(
        Date.now() + EXPORT_URL_TTL_SECONDS * 1000,
      ).toISOString();

      await set(key, exportStatus, EXPORT_CACHE_TTL_SECONDS);
    }
  }

  return exportStatus;
};
