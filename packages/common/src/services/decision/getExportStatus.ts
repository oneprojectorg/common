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

  const signed = await supabase.storage
    .from(EXPORTS_BUCKET)
    .createSignedUrl(filePath, EXPORT_URL_TTL_SECONDS);

  if (signed.error || !signed.data) {
    logger.error('Failed to refresh export signed URL', {
      error: signed.error,
      exportId,
    });

    // A missing object is permanent for this record: retrying can only fail the
    // same way, so report a terminal failure and let the admin start a fresh
    // run. Without this, a record whose file is genuinely gone — every export
    // cached across the deploy that moved buckets, for one — would offer a
    // retry that could never succeed until its 24h TTL ran out.
    //
    // Matched on the message because nothing else distinguishes it: this
    // Supabase build answers `status` 400 for every signing failure. Confirmed
    // to be the wording for both a missing object and a missing bucket. A
    // mismatch degrades to the retryable branch below, which is the safe way
    // round.
    if (signed.error?.message.includes('Object not found')) {
      return { ...exportStatus, status: 'failed', signedUrl: undefined };
    }

    // Anything else may be momentary. The run succeeded and the object is still
    // there, so report a completed export with no URL — which the client offers
    // to retry — rather than a terminal failure that would make it discard the
    // export id and cost a re-export of up to a thousand proposals. Not the
    // lapsed URL either: that renders as a download which 400s. The cached
    // record is left untouched so the retry re-reads one still `completed`.
    return { ...exportStatus, signedUrl: undefined };
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
