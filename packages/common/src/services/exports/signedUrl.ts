import { set } from '@op/cache';
import { logger } from '@op/logging';
import { createSBServiceClient } from '@op/supabase/server';

import {
  EXPORTS_BUCKET,
  EXPORT_CACHE_TTL_SECONDS,
  EXPORT_URL_TTL_SECONDS,
  exportDownloadOptions,
} from './constants';

export interface RefreshableExportRecord {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fileName?: string;
  signedUrl?: string;
  urlExpiresAt?: string;
}

// Service-role: no storage policy covers this bucket. Authorize first.
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

// Re-sign slightly early so a URL doesn't expire between the read and the click.
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

  // An unparseable expiry counts as lapsed.
  const expiresAt =
    typeof urlExpiresAt === 'string' ? Date.parse(urlExpiresAt) : Number.NaN;

  return (
    Number.isNaN(expiresAt) ||
    expiresAt < Date.now() + URL_EXPIRY_MARGIN_MS ||
    !urlServesAsAttachment(signedUrl)
  );
};

// Matched on the message: Supabase returns no error code for signing failures.
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

// Mutates `record` in place.
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

    // A missing file is permanent; other failures stay retryable.
    if (isPermanentlyGone(error)) {
      record.status = 'failed';
    }
  }
};
