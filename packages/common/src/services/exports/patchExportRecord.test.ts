import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@op/cache', () => ({
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock('@op/logging', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { get, set } from '@op/cache';
import { logger } from '@op/logging';

import { EXPORT_CACHE_TTL_SECONDS } from './constants';
import { failedExportPatch, patchExportRecord } from './patchExportRecord';

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

describe('failedExportPatch', () => {
  it('reports the failure', () => {
    expect(failedExportPatch('e1', new Error('boom'))).toMatchObject({
      status: 'failed',
      completedAt: expect.any(String),
    });
  });

  // The status read hands this record to the subject verbatim. A driver error
  // carries our SQL and its parameters, which for a personal data export are the
  // subject's own rows, so the cause goes to the log and not to the client.
  it('keeps the cause out of the record and puts it in the log', () => {
    const cause = new Error(
      'Failed query: select ... params: alice@example.com',
    );

    expect(failedExportPatch('e1', cause)).not.toHaveProperty('errorMessage');
    expect(logger.error).toHaveBeenCalledWith('Export run failed', {
      exportId: 'e1',
      error: cause,
    });
  });
});
