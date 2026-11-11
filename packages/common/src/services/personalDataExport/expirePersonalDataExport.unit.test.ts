import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@op/cache', () => ({
  setWithStatus: vi.fn(),
}));

const storage = vi.hoisted(() => {
  const remove = vi.fn();

  return { remove, from: vi.fn(() => ({ remove })) };
});

// Only the storage path the function touches.
vi.mock('@op/supabase/server', () => ({
  createSBServiceClient: () => ({ storage: { from: storage.from } }),
}));

import { setWithStatus } from '@op/cache';

import { EXPORTS_BUCKET } from '../exports/constants';
import {
  personalDataExportCacheKey,
  personalDataExportFilePath,
} from './constants';
import { expirePersonalDataExport } from './expirePersonalDataExport';

const EXPORT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const FILE_NAME = 'personal-data.json';

const { remove, from } = storage;

const expire = () =>
  expirePersonalDataExport({
    exportId: EXPORT_ID,
    userId: USER_ID,
    fileName: FILE_NAME,
  });

describe('expirePersonalDataExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    remove.mockResolvedValue({ data: [], error: null });
    vi.mocked(setWithStatus).mockResolvedValue({ status: 'ok' });
  });

  it('deletes the file, then the record', async () => {
    await expire();

    expect(from).toHaveBeenCalledWith(EXPORTS_BUCKET);
    expect(remove).toHaveBeenCalledWith([
      personalDataExportFilePath(USER_ID, FILE_NAME),
    ]);
    expect(setWithStatus).toHaveBeenCalledWith(
      personalDataExportCacheKey(EXPORT_ID),
      null,
    );
    expect(remove.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(setWithStatus).mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('keeps the record when the file cannot be deleted, so a retry can find it', async () => {
    remove.mockResolvedValue({ data: null, error: { message: 'boom' } });

    await expect(expire()).rejects.toThrow();
    expect(setWithStatus).not.toHaveBeenCalled();
  });

  it.each(['timeout', 'error'] as const)(
    'throws when deleting the record reports %s, so the step retries',
    async (status) => {
      vi.mocked(setWithStatus).mockResolvedValue({ status });

      await expect(expire()).rejects.toThrow();
    },
  );

  it('treats a disabled cache as nothing left to delete', async () => {
    vi.mocked(setWithStatus).mockResolvedValue({ status: 'disabled' });

    await expect(expire()).resolves.toBeUndefined();
  });
});
