import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@op/cache', () => ({
  get: vi.fn(),
  set: vi.fn(),
}));

import { get, set } from '@op/cache';

import { EXPORT_CACHE_TTL_SECONDS } from './constants';
import { patchExportRecord } from './patchExportRecord';

const written = () =>
  vi.mocked(set).mock.calls[0] as [string, Record<string, unknown>, number];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('patchExportRecord', () => {
  // A write that replaced the record would drop the subject and the format on
  // the way to `completed`, leaving a record the status read cannot parse.
  it('merges the update over the stored record', async () => {
    vi.mocked(get).mockResolvedValue({
      exportId: 'e1',
      userId: 'u1',
      status: 'pending',
    });

    await patchExportRecord('key', { status: 'completed' });

    const [key, record, ttl] = written();

    expect(key).toBe('key');
    expect(record).toEqual({
      exportId: 'e1',
      userId: 'u1',
      status: 'completed',
    });
    expect(ttl).toBe(EXPORT_CACHE_TTL_SECONDS);
  });

  it('writes the patch alone when the cache holds no record', async () => {
    vi.mocked(get).mockResolvedValue(null);

    await patchExportRecord('key', { status: 'processing' });

    expect(written()[1]).toEqual({ status: 'processing' });
  });

  // Spreading a string would scatter its character indices across the record.
  it.each([['a string'], [42], [true]])(
    'ignores a stored value that is not an object (%p)',
    async (stored) => {
      vi.mocked(get).mockResolvedValue(stored);

      await patchExportRecord('key', { status: 'failed' });

      expect(written()[1]).toEqual({ status: 'failed' });
    },
  );
});
