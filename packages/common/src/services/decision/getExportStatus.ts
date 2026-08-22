import { get, set } from '@op/cache';
import { db, eq } from '@op/db/client';
import { processInstances } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { createSBServerClient } from '@op/supabase/server';
import { permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { assertProfileAccess } from '../assert';
import {
  EXPORTS_BUCKET,
  EXPORT_CACHE_TTL_SECONDS,
  EXPORT_URL_TTL_SECONDS,
  exportDownloadOptions,
  exportFilePath,
  exportStatusCacheKey,
} from './exports';

/**
 * Does a stored signed URL already ask Supabase for an attachment?
 *
 * `exportDownloadOptions` puts the file name in a `download` query param, and
 * that param is the whole of what makes the CSV save rather than render. A
 * record cached before that option existed holds a URL without it, so expiry
 * is not on its own a sufficient test of whether a stored URL still works.
 *
 * Reads the query with `URLSearchParams` rather than matching the string, so
 * param order cannot fool it and a malformed cached value returns false
 * instead of throwing on a read path that must not fail.
 */
const servesAsAttachment = (signedUrl: string | undefined): boolean => {
  const query = signedUrl?.split('?')[1];

  return query !== undefined && new URLSearchParams(query).has('download');
};

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
  logger: { info: (message: string, meta?: any) => void };
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
    // A URL that renders instead of downloading is as unusable as an expired
    // one, so it is re-signed on the same path. This is what stops the reported
    // bug from outliving the deploy by up to EXPORT_URL_TTL_SECONDS on records
    // cached before the download option was passed.
    const isStale =
      expiresAt < new Date() || !servesAsAttachment(exportStatus.signedUrl);

    if (isStale) {
      logger.info('Refreshing signed URL', {
        exportId,
      });

      const filePath = exportFilePath(
        exportStatus.processInstanceId,
        exportStatus.fileName,
      );

      const supabase = await createSBServerClient();
      const { data: urlData, error: urlError } = await supabase.storage
        .from(EXPORTS_BUCKET)
        .createSignedUrl(
          filePath,
          EXPORT_URL_TTL_SECONDS,
          exportDownloadOptions(exportStatus.fileName),
        );

      if (!urlError && urlData) {
        exportStatus.signedUrl = urlData.signedUrl;
        exportStatus.urlExpiresAt = new Date(
          Date.now() + EXPORT_URL_TTL_SECONDS * 1000,
        ).toISOString();

        await set(key, exportStatus, EXPORT_CACHE_TTL_SECONDS);
      }
    }
  }

  return exportStatus;
};
