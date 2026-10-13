import { beforeEach, describe, expect, it, vi } from 'vitest';

// Reading the record and refreshing the URL are shared delivery code with their
// own tests. What is under test here is who may read a record.
vi.mock('../exports', () => ({
  readExportRecord: vi.fn(),
  refreshStaleSignedUrl: vi.fn(),
}));

import type { User } from '@op/supabase/lib';

import { UnauthorizedError } from '../../utils';
import { readExportRecord, refreshStaleSignedUrl } from '../exports';
import { getPersonalDataExportStatus } from './getPersonalDataExportStatus';

const EXPORT_ID = '11111111-1111-4111-8111-111111111111';
const SUBJECT_AUTH_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_AUTH_ID = '44444444-4444-4444-8444-444444444444';

const completedRecord = {
  exportId: EXPORT_ID,
  userId: SUBJECT_AUTH_ID,
  status: 'completed' as const,
  fileName: 'personal_data_export_1.json',
  signedUrl: 'https://storage.example/f.json?download=f.json',
  urlExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  createdAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  truncatedSections: [],
};

const readAs = (authUserId: string) =>
  getPersonalDataExportStatus({
    exportId: EXPORT_ID,
    user: { id: authUserId } as User,
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readExportRecord).mockResolvedValue(completedRecord);
});

describe('getPersonalDataExportStatus authorization', () => {
  it('answers the subject the export belongs to', async () => {
    const result = await readAs(SUBJECT_AUTH_ID);

    expect(result).toMatchObject({
      status: 'completed',
      userId: SUBJECT_AUTH_ID,
    });
  });

  // No role grants access to someone else's record, and an export id is a UUID a
  // caller could hold from a shared link or a log line.
  it('refuses a caller who is not the subject', async () => {
    await expect(readAs(OTHER_AUTH_ID)).rejects.toThrow(UnauthorizedError);
  });

  it('signs nothing for a caller who is not the subject', async () => {
    await expect(readAs(OTHER_AUTH_ID)).rejects.toThrow();

    expect(refreshStaleSignedUrl).not.toHaveBeenCalled();
  });

  // An unreadable record carries no owner, so it must not reach the ownership
  // check — that would compare the caller against `undefined`.
  it('reports an unreadable record as not found rather than checking its owner', async () => {
    vi.mocked(readExportRecord).mockResolvedValue(null);

    await expect(readAs(OTHER_AUTH_ID)).resolves.toEqual({
      status: 'not_found',
    });
    expect(refreshStaleSignedUrl).not.toHaveBeenCalled();
  });
});

describe('getPersonalDataExportStatus record reads', () => {
  // Dropped on the way out, the subject holds a short file that reports success.
  it('carries the truncation notice through the read', async () => {
    vi.mocked(readExportRecord).mockResolvedValue({
      ...completedRecord,
      truncatedSections: ['posts'],
    });

    await expect(readAs(SUBJECT_AUTH_ID)).resolves.toMatchObject({
      truncatedSections: ['posts'],
    });
  });

  it('reads the record from the personal data export namespace', async () => {
    await readAs(SUBJECT_AUTH_ID);

    expect(readExportRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        exportId: EXPORT_ID,
        cacheKey: `export:personalData:${EXPORT_ID}`,
      }),
    );
  });
});

describe('getPersonalDataExportStatus download URL', () => {
  it('rebuilds the storage key from the record it just authorized', async () => {
    await readAs(SUBJECT_AUTH_ID);

    const [call] = vi.mocked(refreshStaleSignedUrl).mock.calls;
    const { resolveFilePath } = call![0];

    expect(resolveFilePath('f.json')).toBe(
      `user/${SUBJECT_AUTH_ID}/personal-data/f.json`,
    );
  });
});
