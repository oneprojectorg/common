import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@op/cache', () => ({
  expireIfEqualsWithStatus: vi.fn(),
}));

import { expireIfEqualsWithStatus } from '@op/cache';

import {
  PERSONAL_DATA_EXPORT_FILE_LIFETIME_MS,
  personalDataExportActiveKey,
} from './constants';
import { holdActivePersonalDataExport } from './holdActivePersonalDataExport';

const USER_ID = '33333333-3333-4333-8333-333333333333';
const EXPORT_ID = '44444444-4444-4444-8444-444444444444';

const hold = () =>
  holdActivePersonalDataExport({ userId: USER_ID, exportId: EXPORT_ID });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(expireIfEqualsWithStatus).mockResolvedValue({ status: 'ok' });
});

describe('holdActivePersonalDataExport', () => {
  it('keeps the claim this export holds for less than the file lifetime', async () => {
    await hold();

    const [args] = vi.mocked(expireIfEqualsWithStatus).mock.calls[0] ?? [];
    expect(args).toMatchObject({
      key: personalDataExportActiveKey(USER_ID),
      data: EXPORT_ID,
    });
    expect(args?.ttlSeconds).toBeGreaterThan(0);
    expect(args?.ttlSeconds).toBeLessThan(
      PERSONAL_DATA_EXPORT_FILE_LIFETIME_MS / 1000,
    );
  });

  it.each([['timeout'], ['error']] as const)(
    'throws so the step retries when the hold reports %s',
    async (status) => {
      vi.mocked(expireIfEqualsWithStatus).mockResolvedValue({ status });

      await expect(hold()).rejects.toThrow();
    },
  );
});
