import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

// The cache is the only store this reads. Driving it is the whole test.
vi.mock('@op/cache', () => ({
  getWithStatus: vi.fn(),
}));

vi.mock('@op/logging', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { getWithStatus } from '@op/cache';

import { CommonError } from '../../utils';
import { readExportRecord } from './readExportRecord';

const EXPORT_ID = '11111111-1111-4111-8111-111111111111';

const schema = z.object({
  exportId: z.string(),
  userId: z.string(),
  status: z.enum(['pending', 'completed']),
});

const record = {
  exportId: EXPORT_ID,
  userId: 'subject',
  status: 'completed',
};

const read = () =>
  readExportRecord({ exportId: EXPORT_ID, cacheKey: 'key', schema });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getWithStatus).mockResolvedValue({ status: 'hit', data: record });
});

describe('readExportRecord', () => {
  it('returns the record when the cache holds a valid one', async () => {
    await expect(read()).resolves.toEqual(record);
  });

  it('returns null when the cache held nothing', async () => {
    vi.mocked(getWithStatus).mockResolvedValue({ status: 'miss' });

    await expect(read()).resolves.toBeNull();
  });

  // "Redis did not answer" is not "there is no such export". Export state lives
  // only in the cache and a client retires the export id on a not-found, so one
  // timeout reported as a miss discards a finished run: the file is gone from
  // the only place that knew about it, and the retry points at a control no
  // longer on screen.
  it.each(['timeout', 'error'] as const)(
    'refuses to call a %s a missing export',
    async (status) => {
      vi.mocked(getWithStatus).mockResolvedValue({ status });

      await expect(read()).rejects.toThrow(CommonError);
    },
  );

  // Reachable, not theoretical: a workflow patches the record by merging over
  // the copy it reads, and writes the patch alone when that read misses. One
  // eviction leaves a record holding a status and nothing else.
  //
  // It matters that this returns null rather than the value. Such a record
  // carries no owner, so a caller that received it would authorize against
  // `undefined`.
  it('returns null for a record that does not match its schema', async () => {
    vi.mocked(getWithStatus).mockResolvedValue({
      status: 'hit',
      data: { status: 'completed' },
    });

    await expect(read()).resolves.toBeNull();
  });

  // The schema is what validates the cache, so a caller that asserted the type
  // instead would carry unchecked fields into the response.
  it('validates rather than trusts what the cache returned', async () => {
    vi.mocked(getWithStatus).mockResolvedValue({
      status: 'hit',
      data: { ...record, status: 'not-a-status' },
    });

    await expect(read()).resolves.toBeNull();
  });
});
