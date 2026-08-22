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

/**
 * Structural rather than imported: `@op/api` depends on this package, not the
 * other way round. Shaped to match the `ContextLogger` the tRPC procedure
 * actually passes, which is what keeps an `any` out of the signature.
 */
type ExportLogger = {
  info: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
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
  logger: ExportLogger;
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

  // Mutates `exportStatus` in place when it succeeds, so the record returned
  // below carries the fresh URL.
  await refreshStaleSignedUrl({ exportStatus, cacheKey: key, logger });

  return exportStatus;
};

/**
 * Is a stored export URL no longer usable?
 *
 * Three ways it can be. Signed URLs are shorter-lived than the record that
 * holds them, so it can simply have lapsed. It can be a URL minted before the
 * download option existed — which renders in the browser instead of saving, and
 * is therefore just as unusable however long it has left; gating on expiry
 * alone leaves the reported bug live for up to EXPORT_URL_TTL_SECONDS after
 * deploy on every record already in the cache. Or the record can carry no
 * expiry at all, which is not evidence of a working URL: bailing out there
 * stranded the export for the rest of the record's life with the object sitting
 * in the bucket.
 *
 * Only `fileName` is genuinely required, because that is what rebuilds the
 * storage key.
 */
const needsFreshUrl = ({
  status,
  fileName,
  signedUrl,
  urlExpiresAt,
}: ExportStatusData): boolean => {
  if (status !== 'completed' || !fileName) {
    return false;
  }

  return (
    !urlExpiresAt ||
    new Date(urlExpiresAt) < new Date() ||
    !servesAsAttachment(signedUrl)
  );
};

/**
 * Mint a signed, attachment-serving download URL for an export's stored file.
 *
 * Signs with the service client, not the caller's. Exports live at
 * `process/<instanceId>/proposals/<file>`, and the only SELECT policy on the
 * assets bucket requires the first path segment to equal the caller's uid — so
 * an anon-key client cannot see the object at all and signing fails with
 * "Object not found". Callers settle authorization before reaching this;
 * `getProposal` and the resources signer read objects outside a user's own
 * folder the same way.
 *
 * Throws rather than returning a failure, so the one caller's degradation
 * boundary is the only place that decides what a failed re-sign costs.
 */
const mintSignedDownloadUrl = async ({
  processInstanceId,
  fileName,
}: {
  processInstanceId: string;
  fileName: string;
}): Promise<string> => {
  const supabase = createSBServiceClient();
  const { data, error } = await supabase.storage
    .from(EXPORTS_BUCKET)
    .createSignedUrl(
      exportFilePath(processInstanceId, fileName),
      EXPORT_URL_TTL_SECONDS,
      exportDownloadOptions(fileName),
    );

  if (error || !data) {
    throw error ?? new Error('Signing returned no URL');
  }

  return data.signedUrl;
};

/**
 * Re-sign a stale export URL in place and write the record back to the cache.
 *
 * Leaves `exportStatus` untouched when its URL is still good, and when the
 * re-sign fails.
 */
const refreshStaleSignedUrl = async ({
  exportStatus,
  cacheKey,
  logger,
}: {
  exportStatus: ExportStatusData;
  cacheKey: string;
  logger: ExportLogger;
}): Promise<void> => {
  const { exportId, fileName } = exportStatus;

  if (!fileName || !needsFreshUrl(exportStatus)) {
    return;
  }

  logger.info('Refreshing signed URL', { exportId });

  // Deliberately broad, against the usual narrow-catch rule: this is a
  // degradation boundary, not error handling. Every way the re-sign can fail —
  // a client that cannot be built because SUPABASE_SERVICE_ROLE is unset (which
  // throws synchronously), a sign that is refused, a cache write that fails —
  // costs the caller only a fresher URL, while letting any of them escape costs
  // the record itself. That is far worse: the button escalates to its error
  // boundary and the admin loses the Download CSV link, with only a "Try again"
  // that re-runs the whole export.
  try {
    exportStatus.signedUrl = await mintSignedDownloadUrl({
      processInstanceId: exportStatus.processInstanceId,
      fileName,
    });
    exportStatus.urlExpiresAt = new Date(
      Date.now() + EXPORT_URL_TTL_SECONDS * 1000,
    ).toISOString();

    await set(cacheKey, exportStatus, EXPORT_CACHE_TTL_SECONDS);
  } catch (error) {
    // `error`, not `warn`: the admin is handed back the stale URL and the UI
    // still renders an enabled Download CSV link that either 404s or renders
    // inline. This is also the rescue path for every pre-fix record, so a
    // failure that does not reach error tracking is a fix that reports success
    // while still serving the URL it replaced.
    logger.error('Failed to re-sign export URL', { exportId, error });
  }
};
