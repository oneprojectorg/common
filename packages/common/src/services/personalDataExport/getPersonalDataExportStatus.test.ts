import { beforeEach, describe, expect, it, vi } from 'vitest';

// Boundary mocks. Reading the cached record and refreshing a lapsed URL are
// shared delivery code with their own tests. What is under test here is what
// this module decides between them — who may read a record, and what an
// unreadable one means for the caller.
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

  // The file is one person's whole record, so ownership is the entire
  // authorization question — there is no role that grants access to someone
  // else's. An export id is a UUID a caller could hold from a shared link or a
  // log line.
  it('refuses a caller who is not the subject', async () => {
    await expect(readAs(OTHER_AUTH_ID)).rejects.toThrow(UnauthorizedError);
  });

  // Ownership is settled before anything is signed, so a caller who does not own
  // the export never causes a working URL to exist for it.
  it('signs nothing for a caller who is not the subject', async () => {
    await expect(readAs(OTHER_AUTH_ID)).rejects.toThrow();

    expect(refreshStaleSignedUrl).not.toHaveBeenCalled();
  });

  // A record the cache could not supply — absent, or present but describing no
  // export — carries no owner, so it must not reach the ownership check. That
  // check would otherwise compare the caller against `undefined`.
  it('reports an unreadable record as not found rather than checking its owner', async () => {
    vi.mocked(readExportRecord).mockResolvedValue(null);

    await expect(readAs(OTHER_AUTH_ID)).resolves.toEqual({
      status: 'not_found',
    });
    expect(refreshStaleSignedUrl).not.toHaveBeenCalled();
  });
});

describe('getPersonalDataExportStatus record reads', () => {
  // The record schema is not strict, so a field it does not name is stripped
  // from every parsed record. A truncation notice dropped on the way out leaves
  // the subject holding a short file that reports success.
  it('carries the truncation notice through the read', async () => {
    vi.mocked(readExportRecord).mockResolvedValue({
      ...completedRecord,
      truncatedSections: ['posts'],
    });

    await expect(readAs(SUBJECT_AUTH_ID)).resolves.toMatchObject({
      truncatedSections: ['posts'],
    });
  });

  // The read is filed under this pipeline's own namespace. A key shared with the
  // proposal export would let either status read parse the other's record
  // against the wrong schema, and report a live export as missing.
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
  // The record outlives any single signature, so a subject returning to a
  // finished export must get a fresh URL rather than a dead one. This module
  // owns only the key the refresh rebuilds from; the refresh itself is tested
  // where it lives.
  it('rebuilds the storage key from the record it just authorized', async () => {
    await readAs(SUBJECT_AUTH_ID);

    const [call] = vi.mocked(refreshStaleSignedUrl).mock.calls;
    const { resolveFilePath } = call![0];

    expect(resolveFilePath('f.json')).toBe(
      `user/${SUBJECT_AUTH_ID}/personal-data/f.json`,
    );
  });
});
