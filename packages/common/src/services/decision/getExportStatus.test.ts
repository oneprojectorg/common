import { beforeEach, describe, expect, it, vi } from 'vitest';

// Boundary mocks: getExportStatus is orchestration over the cache, the access
// gate, and Supabase storage. We drive those and assert what it does with a
// completed export whose signed URL has lapsed — the refresh path that was
// unreachable before the record was made longer-lived than the URL.
vi.mock('@op/cache', () => ({
  get: vi.fn(),
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

import { get, set } from '@op/cache';
import { db } from '@op/db/client';
import { createSBServiceClient } from '@op/supabase/server';

import {
  EXPORTS_BUCKET,
  EXPORT_CACHE_TTL_SECONDS,
  EXPORT_URL_TTL_SECONDS,
  exportFilePath,
} from './exports';
import { getExportStatus } from './getExportStatus';

const EXPORT_ID = '11111111-1111-4111-8111-111111111111';
const INSTANCE_ID = '22222222-2222-4222-8222-222222222222';
const AUTH_USER_ID = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-08-10T12:00:00.000Z');

const user = { id: AUTH_USER_ID } as never;
const logger = { info: vi.fn(), error: vi.fn() };

const createSignedUrl = vi.fn();

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

describe('getExportStatus', () => {
  it('returns not_found when the record has aged out of the cache', async () => {
    vi.mocked(get).mockResolvedValue(null);

    const result = await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(result).toEqual({ status: 'not_found' });
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it('re-signs a completed export whose URL has expired', async () => {
    vi.mocked(get).mockResolvedValue(expiredRecord());

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
    vi.mocked(get).mockResolvedValue(expiredRecord());
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
    vi.mocked(get).mockResolvedValue(expiredRecord());
    createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: 'Storage is having a moment' },
    });

    const result = await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(logger.error).toHaveBeenCalled();
    expect(result).toMatchObject({ status: 'completed' });
    expect((result as { signedUrl?: string }).signedUrl).toBeUndefined();
    // No server-minted message: the client renders `errorMessage` verbatim and
    // only reaches its translated fallback when the field is absent.
    expect((result as { errorMessage?: string }).errorMessage).toBeUndefined();
    // The record is left as it is, so the retry re-reads one still marked
    // `completed` and signs again.
    expect(set).not.toHaveBeenCalled();
  });

  // A missing object cannot be retried into existence, so offering a retry
  // would loop until the record's TTL ran out. Every export cached across the
  // deploy that moved buckets lands here: its file is still in `assets`.
  it('reports a terminal failure when the object is gone', async () => {
    vi.mocked(get).mockResolvedValue(expiredRecord());
    createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: 'Object not found' },
    });

    const result = await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(result).toMatchObject({ status: 'failed' });
    expect((result as { signedUrl?: string }).signedUrl).toBeUndefined();
    expect(set).not.toHaveBeenCalled();
  });

  // The original bug: the recorded expiry claimed 24h while the URL itself was
  // minted for 2h, so callers trusted a link that had been dead for 22 hours.
  it('records an expiry that matches the URL it just minted', async () => {
    vi.mocked(get).mockResolvedValue(expiredRecord());

    const result = await getExportStatus({ exportId: EXPORT_ID, user, logger });

    const signedFor = vi.mocked(createSignedUrl).mock.calls[0]?.[1];
    expect(signedFor).toBe(EXPORT_URL_TTL_SECONDS);

    const recordedExpiry = new Date(
      (result as { urlExpiresAt: string }).urlExpiresAt,
    );
    expect(recordedExpiry.getTime()).toBe(NOW.getTime() + signedFor * 1000);
  });

  it('writes the refreshed record back under the longer record TTL', async () => {
    vi.mocked(get).mockResolvedValue(expiredRecord());

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
    vi.mocked(get).mockResolvedValue(expiredRecord());
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

    expect((failed as { signedUrl?: string }).signedUrl).toBeUndefined();

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
      vi.mocked(get).mockResolvedValue({ ...expiredRecord(), urlExpiresAt });

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

  it('leaves a still-valid URL alone', async () => {
    vi.mocked(get).mockResolvedValue({
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
    vi.mocked(get).mockResolvedValue({
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

  it('does not attempt a refresh for an export that never produced a file', async () => {
    vi.mocked(get).mockResolvedValue({
      ...expiredRecord(),
      status: 'failed',
      fileName: undefined,
      signedUrl: undefined,
      errorMessage: 'Storage upload failed',
    });

    await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it('rejects a caller who does not own the export', async () => {
    vi.mocked(get).mockResolvedValue({
      ...expiredRecord(),
      userId: 'someone-else',
    });

    await expect(
      getExportStatus({ exportId: EXPORT_ID, user, logger }),
    ).rejects.toThrow();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});
