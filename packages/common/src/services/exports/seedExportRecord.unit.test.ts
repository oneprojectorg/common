import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@op/cache', () => ({
  setWithStatus: vi.fn(),
}));

import { setWithStatus } from '@op/cache';

import { CommonError } from '../../utils';
import { EXPORT_CACHE_TTL_SECONDS } from './constants';
import { seedExportRecord } from './seedExportRecord';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('seedExportRecord', () => {
  it('writes the record under the export cache TTL', async () => {
    vi.mocked(setWithStatus).mockResolvedValue({ status: 'ok' });

    await seedExportRecord('key', { status: 'pending' });

    expect(setWithStatus).toHaveBeenCalledWith(
      'key',
      { status: 'pending' },
      EXPORT_CACHE_TTL_SECONDS,
    );
  });

  it.each([['timeout'], ['error']] as const)(
    'throws when the write reports %s',
    async (status) => {
      vi.mocked(setWithStatus).mockResolvedValue({ status });

      await expect(
        seedExportRecord('key', { status: 'pending' }),
      ).rejects.toThrow(CommonError);
    },
  );

  it('passes when no cache is configured, as reads treat that as a miss', async () => {
    vi.mocked(setWithStatus).mockResolvedValue({ status: 'disabled' });

    await expect(
      seedExportRecord('key', { status: 'pending' }),
    ).resolves.toBeUndefined();
  });
});
