import { afterEach, describe, expect, it, vi } from 'vitest';

import { CommonError } from './error';
import { signStorageDownloadUrl } from './signStorageDownloadUrl';

const storage = vi.hoisted(() => ({
  from: vi.fn(),
  createSignedUrl: vi.fn(),
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
