import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/signStorageDownloadUrl', () => ({
  signStorageDownloadUrl: vi.fn(),
}));

vi.mock('@op/cache', () => ({
  set: vi.fn(),
}));

vi.mock('@op/logging', () => ({
  logger: { error: vi.fn() },
}));

import { set } from '@op/cache';

import { signStorageDownloadUrl } from '../../utils/signStorageDownloadUrl';
import {
  EXPORTS_BUCKET,
  EXPORT_CACHE_TTL_SECONDS,
  EXPORT_URL_TTL_SECONDS,
} from './constants';
import {
  type RefreshableExportRecord,
  refreshStaleSignedUrl,
  signCompletedExport,
} from './signedUrl';

const EXPORT_ID = 'export-1';
const FILE_NAME = 'export.csv';
const SIGNED_URL = 'https://signed/export.csv?token=t&download=export.csv';

const resolveFilePath = (fileName: string) => `exports/${fileName}`;

const completedRecord = (
  overrides: Partial<RefreshableExportRecord> = {},
): RefreshableExportRecord => ({
  status: 'completed',
  fileName: FILE_NAME,
  ...overrides,
});

const inOneHour = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(signStorageDownloadUrl).mockResolvedValue(SIGNED_URL);
});

describe('signCompletedExport', () => {
  it.each([['pending'], ['processing'], ['failed']] as const)(
    'returns false and signs nothing for a %s record',
    async (status) => {
      const record = completedRecord({ status });

      await expect(
        signCompletedExport({ record, exportId: EXPORT_ID, resolveFilePath }),
      ).resolves.toBe(false);

      expect(signStorageDownloadUrl).not.toHaveBeenCalled();
      expect(record.status).toBe(status);
    },
  );

  it('marks a completed record with no file name as failed and clears its URL', async () => {
    const record = completedRecord({
      fileName: undefined,
      signedUrl: 'https://old',
    });

    await expect(
      signCompletedExport({ record, exportId: EXPORT_ID, resolveFilePath }),
    ).resolves.toBe(false);

    expect(record.status).toBe('failed');
    expect(record.signedUrl).toBeUndefined();
    expect(signStorageDownloadUrl).not.toHaveBeenCalled();
  });

  it('sets the signed URL and passes the TTL through to the signer', async () => {
    const record = completedRecord();

    await expect(
      signCompletedExport({
        record,
        exportId: EXPORT_ID,
        resolveFilePath,
        ttlSeconds: 60,
      }),
    ).resolves.toBe(true);

    expect(record.signedUrl).toBe(SIGNED_URL);
    expect(signStorageDownloadUrl).toHaveBeenCalledWith({
      bucket: EXPORTS_BUCKET,
      storagePath: `exports/${FILE_NAME}`,
      ttlSeconds: 60,
      downloadAs: FILE_NAME,
    });
  });

  it.each([
    ['Object not found', 'failed'],
    ['fetch failed', 'completed'],
  ] as const)(
    'clears the URL when signing fails with %s and leaves the status %s',
    async (message, expectedStatus) => {
      vi.mocked(signStorageDownloadUrl).mockRejectedValue(new Error(message));
      const record = completedRecord({ signedUrl: 'https://old' });

      await expect(
        signCompletedExport({ record, exportId: EXPORT_ID, resolveFilePath }),
      ).resolves.toBe(false);

      expect(record.status).toBe(expectedStatus);
      expect(record.signedUrl).toBeUndefined();
    },
  );
});

describe('refreshStaleSignedUrl', () => {
  it('keeps a fresh attachment URL without re-signing or writing the cache', async () => {
    const urlExpiresAt = inOneHour();
    const record = completedRecord({ signedUrl: SIGNED_URL, urlExpiresAt });

    await refreshStaleSignedUrl({
      record,
      exportId: EXPORT_ID,
      resolveFilePath,
      cacheKey: 'key',
    });

    expect(signStorageDownloadUrl).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    expect(record.urlExpiresAt).toBe(urlExpiresAt);
  });

  it('re-signs a stale URL and writes the record with a new expiry to the cache', async () => {
    const staleExpiry = new Date(Date.now() - 1000).toISOString();
    const record = completedRecord({
      signedUrl: 'https://old?download=export.csv',
      urlExpiresAt: staleExpiry,
    });

    await refreshStaleSignedUrl({
      record,
      exportId: EXPORT_ID,
      resolveFilePath,
      cacheKey: 'key',
    });

    expect(record.signedUrl).toBe(SIGNED_URL);
    expect(record.urlExpiresAt).not.toBe(staleExpiry);
    expect(Date.parse(record.urlExpiresAt ?? '')).toBeGreaterThan(
      Date.now() + (EXPORT_URL_TTL_SECONDS - 60) * 1000,
    );
    expect(set).toHaveBeenCalledWith('key', record, EXPORT_CACHE_TTL_SECONDS);
  });

  it('does not write the cache when signing fails', async () => {
    vi.mocked(signStorageDownloadUrl).mockRejectedValue(
      new Error('fetch failed'),
    );
    const record = completedRecord({ urlExpiresAt: 'not a date' });

    await refreshStaleSignedUrl({
      record,
      exportId: EXPORT_ID,
      resolveFilePath,
      cacheKey: 'key',
    });

    expect(set).not.toHaveBeenCalled();
    expect(record.signedUrl).toBeUndefined();
  });
});
