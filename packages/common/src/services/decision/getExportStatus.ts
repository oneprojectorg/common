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

      // Service-role: every `storage.objects` policy is scoped to
      // `bucket_id = 'assets'`, so a caller-scoped client cannot sign in this
      // bucket. The ownership and `decisions: ADMIN` checks above are what
      // authorize this read.
      const supabase = createSBServiceClient();
      const { data: urlData, error: urlError } = await supabase.storage
        .from(EXPORTS_BUCKET)
        .createSignedUrl(filePath, EXPORT_URL_TTL_SECONDS);

      if (urlError || !urlData) {
        // No signature means no usable link. Reporting this as still `completed`
        // with the URL dropped would be a silent dead end: the client treats a
        // completed export as settled, so it would stop waiting and show neither
        // a download nor an error. `failed` is the one terminal state the client
        // surfaces, and it puts the admin back on a button they can press again —
        // re-exporting rebuilds the file, so a fresh run is the recovery path
        // rather than this record.
        //
        // No `errorMessage`: the client renders whatever is here verbatim and
        // only falls back to a translated string when it is absent, so supplying
        // one would put untranslated English in front of an Arabic or Spanish
        // admin. The detail belongs in the log, which no user reads.
        //
        // The cached record is left `completed` rather than rewritten, so
        // nothing is persisted about a failure that may be momentary.
        logger.error('Failed to refresh export signed URL', {
          error: urlError,
          exportId,
        });

        return { ...exportStatus, status: 'failed', signedUrl: undefined };
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
