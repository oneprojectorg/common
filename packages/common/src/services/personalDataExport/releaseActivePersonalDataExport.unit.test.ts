import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@op/cache', () => ({
  deleteIfEqualsWithStatus: vi.fn(),
}));

import { deleteIfEqualsWithStatus } from '@op/cache';

import { personalDataExportActiveKey } from './constants';
import { releaseActivePersonalDataExport } from './releaseActivePersonalDataExport';

const USER_ID = '33333333-3333-4333-8333-333333333333';
const EXPORT_ID = '44444444-4444-4444-8444-444444444444';

const release = () =>
  releaseActivePersonalDataExport({ userId: USER_ID, exportId: EXPORT_ID });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(deleteIfEqualsWithStatus).mockResolvedValue({ status: 'ok' });
});

describe('releaseActivePersonalDataExport', () => {
  it('deletes the claim only while this export holds it', async () => {
    await release();

    expect(deleteIfEqualsWithStatus).toHaveBeenCalledWith({
      key: personalDataExportActiveKey(USER_ID),
      data: EXPORT_ID,
    });
  });

  it.each([['timeout'], ['error']] as const)(
    'throws so the step retries when the release reports %s',
    async (status) => {
      vi.mocked(deleteIfEqualsWithStatus).mockResolvedValue({ status });

      await expect(release()).rejects.toThrow();
    },
  );
});
