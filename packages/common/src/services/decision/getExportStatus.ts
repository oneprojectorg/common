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
 * Does a stored signed URL ask Supabase for an attachment?
 *
 * `exportDownloadOptions` sets a `download` query param. That param is what
 * makes the CSV save instead of render, so expiry alone does not tell you
 * whether a stored URL still works.
 *
 * Takes `unknown` because the cached record is an unvalidated cast over Redis
 * JSON. This runs outside the re-sign's catch, so a non-string must return
 * false rather than throw.
 */
const servesAsAttachment = (signedUrl: unknown): boolean => {
  if (typeof signedUrl !== 'string') {
    return false;
  }

  const query = signedUrl.split('?')[1];

  return query !== undefined && new URLSearchParams(query).has('download');
};

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

  // Callers declare `signedUrl` as a string and reject the whole record if it
  // is not one. The re-sign skips records that never completed, so scrub here.
  if (typeof exportStatus.signedUrl !== 'string') {
    exportStatus.signedUrl = undefined;
  }

  // Mutates `exportStatus` in place, so the record returned below is current.
  await refreshStaleSignedUrl({ exportStatus, cacheKey: key, logger });

  return exportStatus;
};

/**
 * How much life a stored URL needs to be worth returning.
 *
 * Without a margin, a URL with seconds left reads as fresh and then dies before
 * the click. The button drops its export id on click, so the admin has to
 * re-run the whole export.
 */
const URL_EXPIRY_MARGIN_MS = 60 * 1000;

/**
 * Is a stored export URL unusable?
 *
 * Three cases make it so. The URL has expired, or expires within
 * {@link URL_EXPIRY_MARGIN_MS}. The URL predates the download option, so it
 * renders instead of saving however long it has left. Or the expiry is missing
 * or unreadable, which is no evidence of a working URL.
 *
 * Only `fileName` is required. It rebuilds the storage key.
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

  // `Date.parse` converts its argument to a string first, so a numeric 42 reads
  // as the year 2042. The `typeof` guard sends a missing and a non-string expiry
  // to NaN alike.
  const expiresAt =
    typeof urlExpiresAt === 'string' ? Date.parse(urlExpiresAt) : Number.NaN;

  return (
    Number.isNaN(expiresAt) ||
    expiresAt < Date.now() + URL_EXPIRY_MARGIN_MS ||
    !servesAsAttachment(signedUrl)
  );
};

/**
 * Sign an attachment-serving download URL for an export's stored file.
 *
 * Uses the service client. The only SELECT policy on the assets bucket requires
 * the first path segment to equal the caller's uid, and exports live under
 * `process/<instanceId>/`. An anon-key client gets "Object not found" instead.
 * Callers settle authorization first, as they do for `getProposal`.
 *
 * Throws on failure, so one caller decides what a failed re-sign costs.
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
 * Re-sign a stale export URL in place and cache the result.
 *
 * A still-good URL is left alone. A failed signature leaves the record as it
 * arrived. A failed cache write still returns the fresh URL, and the next read
 * re-signs again.
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

  // Broad on purpose: this is a degradation boundary, not error handling. A
  // failed re-sign costs the caller a fresher URL. An escaped throw costs the
  // record, which sends the button to its error boundary and removes the
  // download link. `createSBServiceClient` throws synchronously, so it is here.
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
    // `error`, not `warn`: the admin still sees an enabled download link, and
    // it either 404s or renders inline.
    logger.error('Failed to re-sign export URL', { exportId, error });
  }
};
