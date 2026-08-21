import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Boundary mocks: getExportStatus is orchestration over the cache, the access
// gate, and Supabase storage. We drive those and assert what it does with a
// completed export whose signed URL has lapsed — the refresh path that was
// unreachable before the record was made longer-lived than the URL.
vi.mock('@op/cache', () => ({
  getWithStatus: vi.fn(),
  set: vi.fn(),
}));

vi.mock('@op/db/client', () => ({
  db: { select: vi.fn() },
  eq: vi.fn(),
}));

vi.mock('@op/supabase/server', () => ({
  createSBServiceClient: vi.fn(),
}));

vi.mock('../assert', () => ({
  assertProfileAccess: vi.fn(),
}));

import { getWithStatus, set } from '@op/cache';
import { db } from '@op/db/client';
import { createSBServiceClient } from '@op/supabase/server';
import { permission } from 'access-zones';

import { assertProfileAccess } from '../assert';
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
const logger = { info: vi.fn(), error: vi.fn() };

const createSignedUrl = vi.fn();

/**
 * Stage what the cache answers. `null` is Redis answering that it holds
 * nothing, which is a different claim from the unreachable cases below — see
 * the tests around `getWithStatus`.
 */
const givenCachedRecord = (record: unknown | null) =>
  vi
    .mocked(getWithStatus)
    .mockResolvedValue(
      record === null ? { status: 'miss' } : { status: 'hit', data: record },
    );

/**
 * Narrow away the `not_found` arm so a test can read record fields directly.
 * Throwing here keeps the assertion at the line that cares, rather than letting
 * a wrong shape surface as `undefined` two lines later.
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
    data: { signedUrl: 'https://storage.example/fresh-url' },
    error: null,
  });
  vi.mocked(createSBServiceClient).mockReturnValue({
    storage: { from: () => ({ createSignedUrl }) },
  } as never);
});

afterEach(() => {
  // `clearAllMocks` does not restore timers, and leaving them installed leaks
  // a frozen clock into anything that runs after this file.
  vi.useRealTimers();
});

describe('getExportStatus', () => {
  it('returns not_found when the record has aged out of the cache', async () => {
    givenCachedRecord(null);

    const result = await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(result).toEqual({ status: 'not_found' });
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it('re-signs a completed export whose URL has expired', async () => {
    givenCachedRecord(expiredRecord());

    const result = await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(result).toMatchObject({
      signedUrl: 'https://storage.example/fresh-url',
    });
  });

  // The client is as much the point as the bucket. Every `storage.objects`
  // policy is scoped to `bucket_id = 'assets'`, so nothing grants a caller any
  // access here and the `createSBServerClient` this used to call could never
  // see the object. Authorization is already complete by the time we sign, so
  // signing with the service role is safe.
  it('signs with the service-role client, in the export bucket, at the instance-scoped path', async () => {
    givenCachedRecord(expiredRecord());
    const storageFrom = vi.fn(() => ({ createSignedUrl }));
    vi.mocked(createSBServiceClient).mockReturnValue({
      storage: { from: storageFrom },
    } as never);

    await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(createSBServiceClient).toHaveBeenCalled();
    expect(storageFrom).toHaveBeenCalledWith(EXPORTS_BUCKET);
    expect(createSignedUrl).toHaveBeenCalledWith(
      exportFilePath(INSTANCE_ID, 'proposals_export_123.csv'),
      EXPORT_URL_TTL_SECONDS,
    );
  });

  // A signing failure that may pass on a second look. Keeping the lapsed URL
  // would render a download that 400s, and reporting `failed` would make the
  // client discard the export id — a full re-export of a run that succeeded —
  // so this stays `completed` with no URL, which the button offers to retry.
  it('reports a completed export with no URL when signing fails transiently', async () => {
    givenCachedRecord(expiredRecord());
    createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: 'Storage is having a moment' },
    });

    const result = await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(logger.error).toHaveBeenCalled();
    expect(result).toMatchObject({ status: 'completed' });
    expect(expectRecord(result).signedUrl).toBeUndefined();
    // No server-minted message: the client renders `errorMessage` verbatim and
    // only reaches its translated fallback when the field is absent.
    expect(expectRecord(result).errorMessage).toBeUndefined();
    // The record is left as it is, so the retry re-reads one still marked
    // `completed` and signs again.
    expect(set).not.toHaveBeenCalled();
  });

  // A missing object cannot be retried into existence, so offering a retry
  // would loop until the record's TTL ran out. Every export cached across the
  // deploy that moved buckets lands here: its file is still in `assets`.
  it.each([['Object not found'], ['Bucket not found']])(
    'reports a terminal failure when signing says %s',
    async (message) => {
      givenCachedRecord(expiredRecord());
      createSignedUrl.mockResolvedValue({ data: null, error: { message } });

      const result = await getExportStatus({
        exportId: EXPORT_ID,
        user,
        logger,
      });

      expect(result).toMatchObject({ status: 'failed' });
      expect(expectRecord(result).signedUrl).toBeUndefined();
      expect(set).not.toHaveBeenCalled();
    },
  );

  // The original bug: the recorded expiry claimed 24h while the URL itself was
  // minted for 2h, so callers trusted a link that had been dead for 22 hours.
  it('records an expiry that matches the URL it just minted', async () => {
    givenCachedRecord(expiredRecord());

    const result = await getExportStatus({ exportId: EXPORT_ID, user, logger });

    const signedFor = vi.mocked(createSignedUrl).mock.calls[0]?.[1];
    expect(signedFor).toBe(EXPORT_URL_TTL_SECONDS);

    const recordedExpiry = expectRecord(result).urlExpiresAt;
    expect(Date.parse(recordedExpiry ?? '')).toBe(
      NOW.getTime() + signedFor * 1000,
    );
  });

  it('writes the refreshed record back under the longer record TTL', async () => {
    givenCachedRecord(expiredRecord());

    await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(set).toHaveBeenCalledWith(
      `export:proposal:${EXPORT_ID}`,
      expect.objectContaining({
        signedUrl: 'https://storage.example/fresh-url',
      }),
      EXPORT_CACHE_TTL_SECONDS,
    );
  });

  // The recovery path the client's retry drives: the same record, read again,
  // signs successfully and comes back with a live URL.
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

    const failed = await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(expectRecord(failed).signedUrl).toBeUndefined();

    const retried = await getExportStatus({
      exportId: EXPORT_ID,
      user,
      logger,
    });

    expect(retried).toMatchObject({
      status: 'completed',
      signedUrl: 'https://storage.example/fresh-url',
    });
  });

  // `new Date('nonsense') < new Date()` is false, so a comparison alone reads a
  // garbled expiry as still fresh and the record keeps serving a URL nobody has
  // checked for the rest of its life.
  it.each([
    ['missing', undefined],
    ['unparseable', 'not-a-timestamp'],
  ])(
    're-signs when the recorded expiry is %s',
    async (_label, urlExpiresAt) => {
      givenCachedRecord({ ...expiredRecord(), urlExpiresAt });

      const result = await getExportStatus({
        exportId: EXPORT_ID,
        user,
        logger,
      });

      expect(createSignedUrl).toHaveBeenCalled();
      expect(result).toMatchObject({
        signedUrl: 'https://storage.example/fresh-url',
      });
    },
  );

  // A URL with seconds left is worse than an expired one: it passes the check
  // and then dies in the admin's hands, and taking the download clears the
  // export id so nothing is left to retry.
  it('re-signs a URL that is about to expire', async () => {
    givenCachedRecord({
      ...expiredRecord(),
      urlExpiresAt: new Date(NOW.getTime() + 5_000).toISOString(),
    });

    const result = await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(createSignedUrl).toHaveBeenCalled();
    expect(result).toMatchObject({
      signedUrl: 'https://storage.example/fresh-url',
    });
  });

  it('leaves a still-valid URL alone', async () => {
    givenCachedRecord({
      ...expiredRecord(),
      signedUrl: 'https://storage.example/live-url',
      urlExpiresAt: new Date(NOW.getTime() + 60 * 60 * 1000).toISOString(),
    });

    const result = await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(createSignedUrl).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      signedUrl: 'https://storage.example/live-url',
    });
  });

  // The refresh needs the file name to rebuild the storage key — it does not
  // need the stale URL. Gating on `signedUrl` (as this once did) strands a
  // record that has a file but no usable URL: it can never be re-signed, so the
  // export stays undownloadable for the rest of its life despite the object
  // sitting in the bucket.
  it('refreshes a completed export that has a file but no URL', async () => {
    givenCachedRecord({
      ...expiredRecord(),
      signedUrl: undefined,
    });

    const result = await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(createSignedUrl).toHaveBeenCalledWith(
      exportFilePath(INSTANCE_ID, 'proposals_export_123.csv'),
      EXPORT_URL_TTL_SECONDS,
    );
    expect(result).toMatchObject({
      signedUrl: 'https://storage.example/fresh-url',
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

    await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  // Split from the case above, which set a non-completed status *and* dropped
  // the file name — so it passed whichever guard was doing the work. This one
  // keeps the file name, leaving the status as the only thing under test.
  it('does not attempt a refresh for a run that has not settled', async () => {
    givenCachedRecord({ ...expiredRecord(), status: 'processing' });

    await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(createSignedUrl).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  // Nothing can be signed without a file name, and no later read grows one, so
  // this is terminal. Returning the record untouched instead — which skipping
  // the refresh used to do — reads to the client as a completed export it can
  // retry, and every retry lands back here: a button that never resolves.
  it('reports a terminal failure for a completed export with no file name', async () => {
    givenCachedRecord({
      ...expiredRecord(),
      fileName: undefined,
      signedUrl: undefined,
    });

    const result = await getExportStatus({ exportId: EXPORT_ID, user, logger });

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
      getExportStatus({ exportId: EXPORT_ID, user, logger }),
    ).rejects.toThrow();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  // The ownership check above is the weaker of the two gates. This one is what
  // stands between an authenticated caller and a service-role-signed URL to a
  // CSV of submitter names: signing bypasses RLS, so nothing below the storage
  // layer will catch a caller who should not be here.
  it('demands decision admin on the profile that owns the export', async () => {
    givenCachedRecord(expiredRecord());

    await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(assertProfileAccess).toHaveBeenCalledWith({
      user,
      profileId: 'profile-1',
      permissions: [{ decisions: permission.ADMIN }],
    });
  });

  it('does not sign when the access check rejects', async () => {
    givenCachedRecord(expiredRecord());
    vi.mocked(assertProfileAccess).mockRejectedValue(
      new Error('not a decision admin'),
    );

    await expect(
      getExportStatus({ exportId: EXPORT_ID, user, logger }),
    ).rejects.toThrow('not a decision admin');
    expect(createSBServiceClient).not.toHaveBeenCalled();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  // Absence has to be answered for, not assumed. Export state lives only in the
  // cache, and the client retires the export id on `not_found` — so reporting a
  // cache it could not reach as "no such export" discards a finished run of up
  // to a thousand proposals on one Redis blip.
  it.each([['timeout'], ['error']] as const)(
    'refuses to call an export missing when the cache answers %s',
    async (status) => {
      vi.mocked(getWithStatus).mockResolvedValue({ status });

      await expect(
        getExportStatus({ exportId: EXPORT_ID, user, logger }),
      ).rejects.toThrow('Could not read the export record.');
      expect(createSignedUrl).not.toHaveBeenCalled();
    },
  );
});
