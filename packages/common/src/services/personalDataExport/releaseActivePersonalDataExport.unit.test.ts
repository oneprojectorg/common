import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@op/cache', () => ({
  getWithStatus: vi.fn(),
  setWithStatus: vi.fn(),
}));

import { getWithStatus, setWithStatus } from '@op/cache';

import { releaseActivePersonalDataExport } from './releaseActivePersonalDataExport';

const USER_ID = '33333333-3333-4333-8333-333333333333';
const EXPORT_ID = '44444444-4444-4444-8444-444444444444';
const OTHER_EXPORT_ID = '55555555-5555-4555-8555-555555555555';

const release = () =>
  releaseActivePersonalDataExport({ userId: USER_ID, exportId: EXPORT_ID });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(setWithStatus).mockResolvedValue({ status: 'ok' });
});

describe('releaseActivePersonalDataExport', () => {
  it('deletes the claim this export holds', async () => {
    vi.mocked(getWithStatus).mockResolvedValue({
      status: 'hit',
      data: EXPORT_ID,
    });

    await release();

    expect(setWithStatus).toHaveBeenCalledWith(
      expect.stringContaining(USER_ID),
      null,
    );
  });

  it.each([
    ['another export holds it', { status: 'hit', data: OTHER_EXPORT_ID }],
    ['nothing holds it', { status: 'miss' }],
  ] as const)('leaves the claim alone when %s', async (_, holder) => {
    vi.mocked(getWithStatus).mockResolvedValue(holder);

    await release();

    expect(setWithStatus).not.toHaveBeenCalled();
  });

  it('throws so the step retries when the claim cannot be read', async () => {
    vi.mocked(getWithStatus).mockResolvedValue({ status: 'timeout' });

    await expect(release()).rejects.toThrow();
  });

  it('throws so the step retries when the claim cannot be deleted', async () => {
    vi.mocked(getWithStatus).mockResolvedValue({
      status: 'hit',
      data: EXPORT_ID,
    });
    vi.mocked(setWithStatus).mockResolvedValue({ status: 'error' });

    await expect(release()).rejects.toThrow();
  });
});
