import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@op/cache', () => ({
  getWithStatus: vi.fn(),
  setWithStatus: vi.fn(),
}));

import { getWithStatus, setWithStatus } from '@op/cache';

import { CommonError } from '../../utils';
import { EXPORT_CACHE_TTL_SECONDS } from './constants';
import { patchExportRecord } from './patchExportRecord';

const written = () =>
  vi.mocked(setWithStatus).mock.calls[0] as [
    string,
    Record<string, unknown>,
    number,
  ];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(setWithStatus).mockResolvedValue({ status: 'ok' });
});

describe('patchExportRecord', () => {
  it('merges the update over the stored record', async () => {
    vi.mocked(getWithStatus).mockResolvedValue({
      status: 'hit',
      data: {
        exportId: 'e1',
        userId: 'u1',
        status: 'pending',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    });

    await patchExportRecord('key', { status: 'completed' });

    const [key, record, ttl] = written();

    expect(key).toBe('key');
    expect(record).toEqual({
      exportId: 'e1',
      userId: 'u1',
      status: 'completed',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(ttl).toBe(EXPORT_CACHE_TTL_SECONDS);
  });

  it('writes the patch with a fresh createdAt when the cache holds no record', async () => {
    vi.mocked(getWithStatus).mockResolvedValue({ status: 'miss' });

    await patchExportRecord('key', { status: 'processing' });

    expect(written()[1]).toEqual({
      status: 'processing',
      createdAt: expect.any(String),
    });
  });

  it.each([['a string'], [42], [true]])(
    'ignores a stored value that is not an object (%p)',
    async (stored) => {
      vi.mocked(getWithStatus).mockResolvedValue({
        status: 'hit',
        data: stored,
      });

      await patchExportRecord('key', { status: 'failed' });

      expect(written()[1]).toEqual({
        status: 'failed',
        createdAt: expect.any(String),
      });
    },
  );

  it.each([['timeout'], ['error']] as const)(
    'throws without writing when the read reports %s',
    async (status) => {
      vi.mocked(getWithStatus).mockResolvedValue({ status });

      await expect(
        patchExportRecord('key', { status: 'completed' }),
      ).rejects.toThrow(CommonError);

      expect(setWithStatus).not.toHaveBeenCalled();
    },
  );

  it.each([['timeout'], ['error'], ['disabled']] as const)(
    'throws when the write reports %s',
    async (status) => {
      vi.mocked(getWithStatus).mockResolvedValue({ status: 'miss' });
      vi.mocked(setWithStatus).mockResolvedValue({ status });

      await expect(
        patchExportRecord('key', { status: 'completed' }),
      ).rejects.toThrow(CommonError);
    },
  );
});
