import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// These mocks stand in for the boundaries. `getExportStatus` orchestrates the
// cache, the access gate, and Supabase storage. These tests drive those three
// and assert what the function does with a completed export whose signed URL
// has lapsed. That refresh path was unreachable until the record outlived the
// URL.
vi.mock('@op/cache', () => ({
  getWithStatus: vi.fn(),
  set: vi.fn(),
}));

vi.mock('@op/db/client', () => ({
  db: { select: vi.fn() },
  eq: vi.fn(),
}));

vi.mock('@op/supabase/server', () => ({
  createSBServerClient: vi.fn(),
  createSBServiceClient: vi.fn(),
}));

vi.mock('../access', () => ({
  assertInstanceProfileAccess: vi.fn(),
}));

vi.mock('@op/logging', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { getWithStatus, set } from '@op/cache';
import { db } from '@op/db/client';
import { logger } from '@op/logging';
import {
  createSBServerClient,
  createSBServiceClient,
} from '@op/supabase/server';
import { permission } from 'access-zones';

import { assertInstanceProfileAccess } from '../access';
import {
  EXPORTS_BUCKET,
  EXPORT_CACHE_TTL_SECONDS,
  EXPORT_URL_TTL_SECONDS,
  exportFilePath,
} from './exports';
import type { ExportStatusData } from './getExportStatus';
import { getExportStatus } from './getExportStatus';

const EXPORT_ID = '11111111-1111-4111-8111-111111111111';
const INSTANCE_ID = '22222222-2222-4222-8222-222222222222';
const AUTH_USER_ID = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-08-10T12:00:00.000Z');

const user = { id: AUTH_USER_ID } as never;

const createSignedUrl = vi.fn();

// Carries `download` because Supabase appends it and `servesAsAttachment` reads
// it back. Without it, a refreshed record would re-sign on every later read.
const FRESH_URL =
  'https://storage.example/fresh-url?token=abc&download=proposals_export_123.csv';

/**
 * Stages what the cache answers. `null` means Redis answered and held nothing.
 * That is a different claim from the unreachable cases. See the tests around
 * `getWithStatus`.
 */
const givenCachedRecord = (record: unknown | null) =>
  vi
    .mocked(getWithStatus)
    .mockResolvedValue(
      record === null ? { status: 'miss' } : { status: 'hit', data: record },
    );

/**
 * Narrows away the `not_found` arm, so a test can read record fields directly.
 * A throw here fails at the line that cares. A wrong shape would otherwise
 * appear as `undefined` two lines later.
 */
const expectRecord = (
  result: Awaited<ReturnType<typeof getExportStatus>>,
): ExportStatusData => {
  if (result.status === 'not_found') {
    throw new Error('expected an export record, got not_found');
  }

  return result;
};

/** A completed export record whose signed URL lapsed an hour ago. */
const expiredRecord = () => ({
  exportId: EXPORT_ID,
  processInstanceId: INSTANCE_ID,
  userId: AUTH_USER_ID,
  format: 'csv',
  status: 'completed' as const,
  filters: {},
  fileName: 'proposals_export_123.csv',
  signedUrl: 'https://storage.example/stale-url',
  urlExpiresAt: new Date(NOW.getTime() - 60 * 60 * 1000).toISOString(),
  createdAt: new Date(NOW.getTime() - 3 * 60 * 60 * 1000).toISOString(),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);

  // The instance lookup that backs the access check.
  vi.mocked(db.select).mockReturnValue({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve([{ profileId: 'profile-1' }]),
      }),
    }),
  } as never);

  createSignedUrl.mockResolvedValue({
    data: { signedUrl: FRESH_URL },
    error: null,
  });
  vi.mocked(createSBServerClient).mockResolvedValue({
    storage: { from: () => ({ createSignedUrl }) },
  } as never);
  vi.mocked(createSBServiceClient).mockReturnValue({
    storage: { from: () => ({ createSignedUrl }) },
  } as never);
});

afterEach(() => {
  // `clearAllMocks` does not restore timers. Timers left installed leak a
  // frozen clock into whatever runs after this file.
  vi.useRealTimers();
});

describe('getExportStatus', () => {
  it('returns not_found when the record has aged out of the cache', async () => {
    givenCachedRecord(null);

    const result = await getExportStatus({ exportId: EXPORT_ID, user });

    expect(result).toEqual({ status: 'not_found' });
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it('re-signs a completed export whose URL has expired', async () => {
    givenCachedRecord(expiredRecord());

    const result = await getExportStatus({ exportId: EXPORT_ID, user });

    expect(result).toMatchObject({
      signedUrl: FRESH_URL,
    });
  });

  // The client matters as much as the bucket. Every `storage.objects` policy
  // scopes to `bucket_id = 'assets'`, so no policy grants a caller access here.
  // The `createSBServerClient` this once called could never see the object.
  // Authorization completes before the signing call, so the service role is
  // safe to use.
  it('signs with the service-role client, in the export bucket, at the instance-scoped path', async () => {
    givenCachedRecord(expiredRecord());
    const storageFrom = vi.fn(() => ({ createSignedUrl }));
    vi.mocked(createSBServiceClient).mockReturnValue({
      storage: { from: storageFrom },
    } as never);

    await getExportStatus({ exportId: EXPORT_ID, user });

    expect(createSBServiceClient).toHaveBeenCalled();
    expect(createSBServerClient).not.toHaveBeenCalled();
    expect(storageFrom).toHaveBeenCalledWith(EXPORTS_BUCKET);
    expect(createSignedUrl).toHaveBeenCalledWith(
      exportFilePath(INSTANCE_ID, 'proposals_export_123.csv'),
      EXPORT_URL_TTL_SECONDS,
      { download: 'proposals_export_123.csv' },
    );
  });

  // A record cached before this fix holds a URL without `&download=`, still
  // valid for up to EXPORT_URL_TTL_SECONDS. Gating the re-sign on expiry alone
  // leaves the bug live for that whole window. A URL that cannot download is
  // stale whatever its expiry says.
  it('re-signs an unexpired URL that predates the download option', async () => {
    givenCachedRecord({
      ...expiredRecord(),
      signedUrl: 'https://storage.example/pre-fix-url?token=abc',
      urlExpiresAt: new Date(NOW.getTime() + 60 * 60 * 1000).toISOString(),
    });

    const result = await getExportStatus({ exportId: EXPORT_ID, user });

    expect(createSignedUrl).toHaveBeenCalledWith(
      exportFilePath(INSTANCE_ID, 'proposals_export_123.csv'),
      EXPORT_URL_TTL_SECONDS,
      { download: 'proposals_export_123.csv' },
    );
    expect(result).toMatchObject({
      signedUrl: FRESH_URL,
    });
  });

  // This signing failure may pass on a second look. The lapsed URL would
  // render a download that answers 400. A `failed` status would make the client
  // discard the export id, and cost a re-export of a run that succeeded. The
  // record therefore stays `completed` with no URL, and the button offers a
  // retry.
  it('reports a completed export with no URL when signing fails transiently', async () => {
    givenCachedRecord(expiredRecord());
    createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: 'Storage is having a moment' },
    });

    const result = await getExportStatus({ exportId: EXPORT_ID, user });

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to re-sign export URL',
      expect.objectContaining({ exportId: EXPORT_ID }),
    );
    expect(result).toMatchObject({ status: 'completed' });
    expect(expectRecord(result).signedUrl).toBeUndefined();
    // The server sends no message. The client renders `errorMessage` verbatim,
    // and reaches its translated fallback only when the field is absent.
    expect(expectRecord(result).errorMessage).toBeUndefined();
    // This leaves the record alone. The retry re-reads a record still marked
    // `completed`, and signs again.
    expect(set).not.toHaveBeenCalled();
  });

  // `createSBServiceClient` throws synchronously when SUPABASE_SERVICE_ROLE is
  // unset. An escaped throw 500s the query and costs the caller the record
  // itself. Losing the download link is survivable. Losing the record is not.
  it('keeps serving the record when the storage client cannot be built', async () => {
    givenCachedRecord(expiredRecord());
    vi.mocked(createSBServiceClient).mockImplementation(() => {
      throw new Error('SUPABASE_SERVICE_ROLE is not set.');
    });

    const result = await getExportStatus({ exportId: EXPORT_ID, user });

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to re-sign export URL',
      expect.objectContaining({ exportId: EXPORT_ID }),
    );
    expect(result).toMatchObject({ status: 'completed' });
    expect((result as { signedUrl?: string }).signedUrl).toBeUndefined();
  });

  // A record with a file but no expiry used to skip the re-sign, so the export
  // stayed undownloadable for the rest of its 24h life. Latent today, because
  // the workflow always writes both fields together.
  it('re-signs a completed export with no recorded expiry', async () => {
    givenCachedRecord({
      ...expiredRecord(),
      urlExpiresAt: undefined,
    });

    const result = await getExportStatus({ exportId: EXPORT_ID, user });

    expect(createSignedUrl).toHaveBeenCalled();
    expect(result).toMatchObject({ signedUrl: FRESH_URL });
  });

  // `new Date('garbage') < new Date()` is false, so a corrupt expiry beside a
  // download-carrying URL passed every staleness test and was never re-signed.
  it('re-signs a completed export whose expiry cannot be parsed', async () => {
    givenCachedRecord({
      ...expiredRecord(),
      signedUrl: FRESH_URL,
      urlExpiresAt: 'not-a-date',
    });

    await getExportStatus({ exportId: EXPORT_ID, user });

    expect(createSignedUrl).toHaveBeenCalled();
  });

  // A URL with seconds left dies between this read and the click. The button has
  // already cleared its export id, so the admin must re-run the export.
  it('re-signs a URL that is about to expire', async () => {
    givenCachedRecord({
      ...expiredRecord(),
      signedUrl: FRESH_URL,
      urlExpiresAt: new Date(NOW.getTime() + 5_000).toISOString(),
    });

    await getExportStatus({ exportId: EXPORT_ID, user });

    expect(createSignedUrl).toHaveBeenCalled();
  });

  // A record can hold a field of the wrong type as easily as a missing one:
  // nothing but this schema describes what Redis holds. Both of these fields
  // once reached the staleness check as they were, where a non-string URL had to
  // read as "cannot download" and a numeric expiry read as the year 2042.
  // Rejecting the record is stronger and covers every status, not only the one
  // the re-sign handles.
  it.each([
    ['a non-string signed URL', { signedUrl: 42 }],
    ['a non-string expiry', { urlExpiresAt: 42 }],
  ])('reports not_found for a record with %s', async (_label, corruption) => {
    givenCachedRecord({ ...expiredRecord(), ...corruption });

    const result = await getExportStatus({ exportId: EXPORT_ID, user });

    expect(result).toEqual({ status: 'not_found' });
    expect(logger.error).toHaveBeenCalled();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  // No retry recreates a missing object, so a retry would loop until the
  // record's TTL expired. Every export cached across the deploy that moved
  // buckets reaches this branch, because its file remains in `assets`.
  it.each([['Object not found'], ['Bucket not found']])(
    'reports a terminal failure when signing says %s',
    async (message) => {
      givenCachedRecord(expiredRecord());
      createSignedUrl.mockResolvedValue({ data: null, error: { message } });

      const result = await getExportStatus({
        exportId: EXPORT_ID,
        user,
      });

      expect(result).toMatchObject({ status: 'failed' });
      expect(expectRecord(result).signedUrl).toBeUndefined();
      expect(set).not.toHaveBeenCalled();
    },
  );

  // The original bug: the record claimed a 24 hour expiry, and the workflow
  // signed the URL for 2 hours. Callers trusted a link dead for 22 hours.
  it('records an expiry that matches the URL it just minted', async () => {
    givenCachedRecord(expiredRecord());

    const result = await getExportStatus({ exportId: EXPORT_ID, user });

    const signedFor = vi.mocked(createSignedUrl).mock.calls[0]?.[1];
    expect(signedFor).toBe(EXPORT_URL_TTL_SECONDS);

    const recordedExpiry = expectRecord(result).urlExpiresAt;
    expect(Date.parse(recordedExpiry ?? '')).toBe(
      NOW.getTime() + signedFor * 1000,
    );
  });

  it('writes the refreshed record back under the longer record TTL', async () => {
    givenCachedRecord(expiredRecord());

    await getExportStatus({ exportId: EXPORT_ID, user });

    expect(set).toHaveBeenCalledWith(
      `export:proposal:${EXPORT_ID}`,
      expect.objectContaining({
        signedUrl: FRESH_URL,
      }),
      EXPORT_CACHE_TTL_SECONDS,
    );
  });

  // This is the recovery path the client's retry drives. A second read of the
  // same record signs successfully and returns a live URL.
  it('signs successfully when a later read finds storage healthy', async () => {
    givenCachedRecord(expiredRecord());
    createSignedUrl
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Storage is having a moment' },
      })
      .mockResolvedValueOnce({
        data: { signedUrl: 'https://storage.example/fresh-url' },
        error: null,
      });

    const failed = await getExportStatus({ exportId: EXPORT_ID, user });

    expect(expectRecord(failed).signedUrl).toBeUndefined();

    const retried = await getExportStatus({
      exportId: EXPORT_ID,
      user,
    });

    expect(retried).toMatchObject({
      status: 'completed',
      signedUrl: 'https://storage.example/fresh-url',
    });
  });

  // "Still valid" means unexpired and able to download, so the URL here carries
  // `download`. Without it the record is re-signed however long it has left.
  it('leaves a still-valid URL alone', async () => {
    const liveUrl =
      'https://storage.example/live-url?token=abc&download=proposals_export_123.csv';
    givenCachedRecord({
      ...expiredRecord(),
      signedUrl: liveUrl,
      urlExpiresAt: new Date(NOW.getTime() + 60 * 60 * 1000).toISOString(),
    });

    const result = await getExportStatus({ exportId: EXPORT_ID, user });

    expect(createSignedUrl).not.toHaveBeenCalled();
    expect(result).toMatchObject({ signedUrl: liveUrl });
  });

  // The refresh needs the file name to rebuild the storage key. It does not need
  // the stale URL.
  //
  // Gating on `signedUrl`, as this once did, strands a record with a file but no
  // usable URL. It can never be re-signed, so the export stays undownloadable
  // while the object sits in the bucket.
  it('refreshes a completed export that has a file but no URL', async () => {
    givenCachedRecord({
      ...expiredRecord(),
      signedUrl: undefined,
    });

    const result = await getExportStatus({ exportId: EXPORT_ID, user });

    expect(createSignedUrl).toHaveBeenCalledWith(
      exportFilePath(INSTANCE_ID, 'proposals_export_123.csv'),
      EXPORT_URL_TTL_SECONDS,
      { download: 'proposals_export_123.csv' },
    );
    expect(result).toMatchObject({
      signedUrl: FRESH_URL,
    });
  });

  it('does not attempt a refresh for an export that already failed', async () => {
    givenCachedRecord({
      ...expiredRecord(),
      status: 'failed',
      fileName: undefined,
      signedUrl: undefined,
      errorMessage: 'Storage upload failed',
    });

    await getExportStatus({ exportId: EXPORT_ID, user });

    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  // This test splits from the case above. That case set a non-completed status
  // and dropped the file name, so it passed whichever guard did the work. This
  // one keeps the file name, and tests the status alone.
  it('does not attempt a refresh for a run that has not settled', async () => {
    givenCachedRecord({ ...expiredRecord(), status: 'processing' });

    await getExportStatus({ exportId: EXPORT_ID, user });

    expect(createSignedUrl).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  // Without a file name there is nothing to sign, and no later read supplies
  // one, so this state is terminal. Skipping the refresh returned the record
  // untouched. The client read that as a completed export it could retry, and
  // every retry returned here. The button never resolved.
  it('reports a terminal failure for a completed export with no file name', async () => {
    givenCachedRecord({
      ...expiredRecord(),
      fileName: undefined,
      signedUrl: undefined,
    });

    const result = await getExportStatus({ exportId: EXPORT_ID, user });

    expect(result).toMatchObject({ status: 'failed' });
    expect(expectRecord(result).signedUrl).toBeUndefined();
    expect(createSignedUrl).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('rejects a caller who does not own the export', async () => {
    givenCachedRecord({
      ...expiredRecord(),
      userId: 'someone-else',
    });

    await expect(
      getExportStatus({ exportId: EXPORT_ID, user }),
    ).rejects.toThrow();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  // The ownership check above is the weaker of the two gates. This gate stands
  // between an authenticated caller and a signed URL to a CSV of submitter
  // names. The signing call bypasses row level security, so no layer below
  // storage catches a caller who should not be here.
  it('demands decision admin on the profile that owns the export', async () => {
    givenCachedRecord(expiredRecord());

    await getExportStatus({ exportId: EXPORT_ID, user });

    expect(assertInstanceProfileAccess).toHaveBeenCalledWith({
      user,
      // `ownerProfileId: null` is the org fallback being skipped. An org-level
      // grant must not reach a CSV of submitter names.
      instance: { profileId: 'profile-1', ownerProfileId: null },
      profilePermissions: { decisions: permission.ADMIN },
      orgFallbackPermissions: { decisions: permission.ADMIN },
    });
  });

  it('does not sign when the access check rejects', async () => {
    givenCachedRecord(expiredRecord());
    vi.mocked(assertInstanceProfileAccess).mockRejectedValue(
      new Error('not a decision admin'),
    );

    await expect(
      getExportStatus({ exportId: EXPORT_ID, user }),
    ).rejects.toThrow('not a decision admin');
    expect(createSBServiceClient).not.toHaveBeenCalled();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  // The workflow patches the record by merging over the copy it reads, and it
  // writes the patch alone when that read misses. One evicted key therefore
  // leaves a record holding a status and nothing else. No later read repairs
  // it, so this reports `not_found` and the admin starts a fresh run.
  it('reports not_found for a cached record that does not match the schema', async () => {
    givenCachedRecord({ status: 'processing' });

    const result = await getExportStatus({ exportId: EXPORT_ID, user });

    expect(result).toEqual({ status: 'not_found' });
    expect(logger.error).toHaveBeenCalled();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  // A record that parses must not be trusted past its owner. The schema checks
  // the shape; the ownership check below is what checks the caller.
  it('still rejects a caller who does not own a well-formed record', async () => {
    givenCachedRecord({ ...expiredRecord(), userId: 'someone-else' });

    await expect(
      getExportStatus({ exportId: EXPORT_ID, user }),
    ).rejects.toThrow();
  });

  // The cache must answer before this reports absence. Export state lives only
  // in the cache, and the client retires the export id on `not_found`. A cache
  // it could not reach, reported as "no such export", discards a finished run
  // of up to a thousand proposals.
  it.each([['timeout'], ['error']] as const)(
    'refuses to call an export missing when the cache answers %s',
    async (status) => {
      vi.mocked(getWithStatus).mockResolvedValue({ status });

      await expect(
        getExportStatus({ exportId: EXPORT_ID, user }),
      ).rejects.toThrow('Could not read the export record.');
      expect(createSignedUrl).not.toHaveBeenCalled();
    },
  );
});
