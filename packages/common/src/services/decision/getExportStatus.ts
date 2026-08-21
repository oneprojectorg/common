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
  // Structurally the subset of `ContextLogger` this needs. Typed as
  // `Record<string, unknown>` rather than `any` so a malformed meta object is a
  // type error instead of a log line that silently ships a missing field.
  logger: {
    info: (message: string, meta?: Record<string, unknown>) => void;
    error: (message: string, meta?: Record<string, unknown>) => void;
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
    isSignedUrlLapsed(exportStatus.urlExpiresAt)
  ) {
    return refreshSignedUrl({
      exportStatus,
      fileName: exportStatus.fileName,
      cacheKey: key,
      exportId,
      logger,
    });
  }

  return exportStatus;
};

/**
 * Re-sign a completed export whose download URL has lapsed.
 *
 * Split out of {@link getExportStatus} to keep that function about
 * authorization: everything here runs only after the caller has been checked.
 */
const refreshSignedUrl = async ({
  exportStatus,
  fileName,
  cacheKey,
  exportId,
  logger,
}: {
  exportStatus: ExportStatusData;
  fileName: string;
  cacheKey: string;
  exportId: string;
  logger: {
    info: (message: string, meta?: Record<string, unknown>) => void;
    error: (message: string, meta?: Record<string, unknown>) => void;
  };
}): Promise<ExportStatusData> => {
  logger.info('Refreshing expired signed URL', { exportId });

  const filePath = exportFilePath(exportStatus.processInstanceId, fileName);

  // Service-role: every `storage.objects` policy is scoped to
  // `bucket_id = 'assets'`, so a caller-scoped client cannot sign in this
  // bucket. The ownership and `decisions: ADMIN` checks in the caller are what
  // authorize this read.
  const supabase = createSBServiceClient();

  const signUrl = () =>
    supabase.storage
      .from(EXPORTS_BUCKET)
      .createSignedUrl(filePath, EXPORT_URL_TTL_SECONDS);

  // One retry before giving up. Failing here is expensive out of proportion to
  // the cause: the client drops the export id when it sees a terminal state, so
  // a momentary Storage error on an object that is present and signable a second
  // later costs the admin a whole re-export.
  let signed = await signUrl();

  if (signed.error || !signed.data) {
    logger.info('Retrying export signed URL refresh', { exportId });
    signed = await signUrl();
  }

  if (signed.error || !signed.data) {
    // No signature means no usable link. Reporting this as still `completed`
    // with the URL dropped would be a silent dead end: the client treats a
    // completed export as settled, so it would show neither a download nor an
    // error. `failed` is the one terminal state the client surfaces, and it puts
    // the admin back on a button they can press again — re-exporting rebuilds
    // the file, so a fresh run is the recovery path rather than this record.
    //
    // No `errorMessage`: the client renders whatever is here verbatim and only
    // falls back to a translated string when it is absent, so supplying one
    // would put untranslated English in front of an Arabic or Spanish admin.
    // The detail belongs in the log, which no user reads.
    //
    // The cached record is left `completed` rather than rewritten, so nothing is
    // persisted about a failure that may be momentary.
    logger.error('Failed to refresh export signed URL', {
      error: signed.error,
      exportId,
    });

    return { ...exportStatus, status: 'failed', signedUrl: undefined };
  }

  const refreshed: ExportStatusData = {
    ...exportStatus,
    signedUrl: signed.data.signedUrl,
    urlExpiresAt: new Date(
      Date.now() + EXPORT_URL_TTL_SECONDS * 1000,
    ).toISOString(),
  };

  await set(cacheKey, refreshed, EXPORT_CACHE_TTL_SECONDS);

  return refreshed;
};

/**
 * Whether a completed export's download URL needs re-signing.
 *
 * A missing or unparseable expiry counts as lapsed. `new Date('nonsense') <
 * new Date()` is false, so treating the comparison as the whole test would read
 * a garbled timestamp as *fresh* and keep serving whatever `signedUrl` the
 * record holds — a dead one, or none at all — for the rest of its 24h life.
 * Erring towards a re-sign costs one signing call and is self-correcting.
 */
const isSignedUrlLapsed = (urlExpiresAt: string | undefined): boolean => {
  if (!urlExpiresAt) {
    return true;
  }

  const expiresAt = Date.parse(urlExpiresAt);

  return Number.isNaN(expiresAt) || expiresAt < Date.now();
};
