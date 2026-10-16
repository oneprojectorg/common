import { logger } from '@op/logging';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CommonError } from './error';
import {
  signStorageDownloadUrl,
  signStorageDownloadUrlOrNull,
} from './signStorageDownloadUrl';

const storage = vi.hoisted(() => ({
  from: vi.fn(),
  createSignedUrl: vi.fn(),
}));

vi.mock('@op/logging', () => ({
  logger: { warn: vi.fn() },
}));

vi.mock('@op/supabase/server', () => ({
  createSBServiceClient: () => ({ storage: { from: storage.from } }),
}));

storage.from.mockReturnValue({ createSignedUrl: storage.createSignedUrl });

afterEach(() => {
  vi.clearAllMocks();
  storage.from.mockReturnValue({ createSignedUrl: storage.createSignedUrl });
});

describe('signStorageDownloadUrl', () => {
  it('given no bucket, when signing, then it signs in the assets bucket without a download option', async () => {
    storage.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://storage.example/a?token=1' },
      error: null,
    });

    const url = await signStorageDownloadUrl({
      storagePath: 'profile/1/file.pdf',
      ttlSeconds: 60,
    });

    expect(storage.from).toHaveBeenCalledWith('assets');
    expect(storage.createSignedUrl).toHaveBeenCalledWith(
      'profile/1/file.pdf',
      60,
      undefined,
    );
    expect(url).toBe('https://storage.example/a?token=1');
  });

  it('given a bucket and a download name, when signing, then both reach the storage call', async () => {
    storage.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://storage.example/b?download=report.csv' },
      error: null,
    });

    await signStorageDownloadUrl({
      bucket: 'exports',
      storagePath: 'process/1/report.csv',
      ttlSeconds: 3600,
      downloadAs: 'report.csv',
    });

    expect(storage.from).toHaveBeenCalledWith('exports');
    expect(storage.createSignedUrl).toHaveBeenCalledWith(
      'process/1/report.csv',
      3600,
      { download: 'report.csv' },
    );
  });

  it('given storage reports an error, when signing, then it throws a CommonError with that message', async () => {
    storage.createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: 'Object not found' },
    });

    await expect(
      signStorageDownloadUrl({ storagePath: 'missing', ttlSeconds: 60 }),
    ).rejects.toThrow(new CommonError('Object not found'));
  });

  it('given storage returns neither data nor error, when signing, then it throws a CommonError', async () => {
    storage.createSignedUrl.mockResolvedValue({ data: null, error: null });

    await expect(
      signStorageDownloadUrl({ storagePath: 'missing', ttlSeconds: 60 }),
    ).rejects.toThrow(CommonError);
  });
});

describe('signStorageDownloadUrlOrNull', () => {
  it('given storage signs the path, when signing, then it returns the signed URL', async () => {
    storage.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://storage.example/c?token=1' },
      error: null,
    });

    await expect(
      signStorageDownloadUrlOrNull({ storagePath: 'file.pdf', ttlSeconds: 60 }),
    ).resolves.toBe('https://storage.example/c?token=1');
  });

  it('given storage reports an error, when signing, then it returns null instead of throwing', async () => {
    storage.createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: 'Object not found' },
    });

    await expect(
      signStorageDownloadUrlOrNull({ storagePath: 'missing', ttlSeconds: 60 }),
    ).resolves.toBeNull();
  });

  it('given signing fails, when it logs the failure, then the log leaves out the user’s file name', async () => {
    storage.createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: 'Object not found' },
    });

    await signStorageDownloadUrlOrNull({
      storagePath: 'proposals/1/Jane_Doe_application.pdf',
      ttlSeconds: 60,
    });

    expect(logger.warn).toHaveBeenCalledOnce();
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain(
      'Jane_Doe',
    );
  });

  it('given the storage client itself fails, when signing, then the error propagates', async () => {
    storage.createSignedUrl.mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      signStorageDownloadUrlOrNull({ storagePath: 'file.pdf', ttlSeconds: 60 }),
    ).rejects.toThrow(TypeError);
  });
});
