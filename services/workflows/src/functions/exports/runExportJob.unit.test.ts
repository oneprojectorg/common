import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@op/common', () => ({ patchExportRecord: vi.fn() }));
vi.mock('@op/logging', () => ({ logger: { error: vi.fn() } }));
vi.mock('./notifyExportChanged', () => ({ notifyExportChanged: vi.fn() }));

import { patchExportRecord } from '@op/common';
import { logger } from '@op/logging';

import { runExportJob } from './runExportJob';

const step = {
  run: (_id: string, handler: () => Promise<unknown>) => handler(),
};

const run = (produce: () => Promise<Record<string, unknown>>) =>
  runExportJob({
    step,
    exportId: 'e1',
    cacheKey: 'key',
    channel: 'personalDataExport:e1',
    seed: { userId: 'u1' },
    produce,
  });

describe('runExportJob', () => {
  beforeEach(() => vi.clearAllMocks());

  it('records completion with the seed, so an evicted record is whole', async () => {
    await run(async () => ({ fileName: 'f.json' }));

    expect(patchExportRecord).toHaveBeenLastCalledWith('key', {
      exportId: 'e1',
      userId: 'u1',
      status: 'completed',
      fileName: 'f.json',
      completedAt: expect.any(String),
    });
  });

  it('records a failure without its cause and logs the cause', async () => {
    const cause = new Error('Failed query: params: alice@example.com');

    await expect(run(() => Promise.reject(cause))).rejects.toBe(cause);

    expect(patchExportRecord).toHaveBeenLastCalledWith('key', {
      exportId: 'e1',
      userId: 'u1',
      status: 'failed',
      completedAt: expect.any(String),
    });
    expect(logger.error).toHaveBeenCalledWith('Export run failed', {
      exportId: 'e1',
      error: cause,
    });
  });
});
