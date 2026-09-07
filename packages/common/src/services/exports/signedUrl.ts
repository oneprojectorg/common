import { set } from '@op/cache';
import { logger } from '@op/logging';
import { createSBServiceClient } from '@op/supabase/server';

import {
  EXPORTS_BUCKET,
  EXPORT_CACHE_TTL_SECONDS,
  EXPORT_URL_TTL_SECONDS,
  exportDownloadOptions,
} from './constants';

/** The record fields the refresh reads and writes. */
export interface RefreshableExportRecord {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fileName?: string;
  signedUrl?: string;
  urlExpiresAt?: string;
}

// Service-role client: every `storage.objects` policy scopes to
// `bucket_id = 'assets'`, so a caller-scoped client cannot sign here. Callers
// settle authorization before calling.
export const signExportDownloadUrl = async ({
  filePath,
  fileName,
}: {
  filePath: string;
  fileName: string;
}): Promise<string> => {
  const supabase = createSBServiceClient();
  const { data, error } = await supabase.storage
    .from(EXPORTS_BUCKET)
    .createSignedUrl(
      filePath,
      EXPORT_URL_TTL_SECONDS,
      exportDownloadOptions(fileName),
    );

  if (error || !data) {
    throw error ?? new Error('Signing returned no URL');
  }

  return data.signedUrl;
};

const urlServesAsAttachment = (signedUrl: string | undefined): boolean => {
  if (signedUrl === undefined) {
    return false;
  }

  const query = signedUrl.split('?')[1];

  return query !== undefined && new URLSearchParams(query).has('download');
};

// A URL with seconds left passes a bare expiry check, then answers 400 when the
// reader clicks. The margin also absorbs clock skew against storage.
const URL_EXPIRY_MARGIN_MS = 60 * 1000;

const needsFreshUrl = ({
  status,
  fileName,
  signedUrl,
  urlExpiresAt,
}: RefreshableExportRecord): boolean => {
  if (status !== 'completed' || !fileName) {
    return false;
  }

  // NaN counts as lapsed: `new Date('nonsense') < new Date()` is false, so a
  // garbled expiry would otherwise read as fresh for the record's whole life.
  const expiresAt =
    typeof urlExpiresAt === 'string' ? Date.parse(urlExpiresAt) : Number.NaN;

  return (
    Number.isNaN(expiresAt) ||
    expiresAt < Date.now() + URL_EXPIRY_MARGIN_MS ||
    !urlServesAsAttachment(signedUrl)
  );
};

// Matched on the message because this Supabase build answers 400 with no error
// code for every signing failure. A wording missed here falls to the retryable
// branch, which is the safe direction.
const PERMANENT_SIGNING_FAILURES = ['Object not found', 'Bucket not found'];

const isPermanentlyGone = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null || !('message' in error)) {
    return false;
  }

  const { message } = error;

  return (
    typeof message === 'string' &&
    PERMANENT_SIGNING_FAILURES.some((reason) => message.includes(reason))
  );
};

/**
 * Re-sign a lapsed export URL, mutating `record` in place so the caller can
 * return the same object. `resolveFilePath` builds the storage key, whose format
 * each pipeline owns.
 */
export const refreshStaleSignedUrl = async ({
  record,
  exportId,
  resolveFilePath,
  cacheKey,
}: {
  record: RefreshableExportRecord;
  exportId: string;
  resolveFilePath: (fileName: string) => string;
  cacheKey: string;
}): Promise<void> => {
  const { fileName } = record;

  if (!fileName) {
    // Nothing to sign, and no later read supplies a name. Left `completed`, the
    // client would retry forever on an export it can never download.
    if (record.status === 'completed') {
      logger.error('Completed export has no file name', { exportId });

      record.status = 'failed';
      record.signedUrl = undefined;
    }

    return;
  }

  if (!needsFreshUrl(record)) {
    return;
  }

  logger.info('Refreshing signed URL', { exportId });

  // Broad on purpose: a failed re-sign costs the download link, an escaped throw
  // costs the whole record. `createSBServiceClient` throws synchronously.
  try {
    record.signedUrl = await signExportDownloadUrl({
      filePath: resolveFilePath(fileName),
      fileName,
    });
    record.urlExpiresAt = new Date(
      Date.now() + EXPORT_URL_TTL_SECONDS * 1000,
    ).toISOString();

    await set(cacheKey, record, EXPORT_CACHE_TTL_SECONDS);
  } catch (error) {
    logger.error('Failed to re-sign export URL', { exportId, error });

    record.signedUrl = undefined;

    // A missing file fails the same way on every retry, so it goes terminal. Any
    // other failure may be momentary and stays `completed` with no URL, which is
    // the state the client offers a retry for. The cached record is left alone
    // either way.
    if (isPermanentlyGone(error)) {
      record.status = 'failed';
    }
  }
};
