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
  createSBServerClient: vi.fn(),
  createSBServiceClient: vi.fn(),
}));

vi.mock('../assert', () => ({
  assertProfileAccess: vi.fn(),
}));

import { get, set } from '@op/cache';
import { db } from '@op/db/client';
import {
  createSBServerClient,
  createSBServiceClient,
} from '@op/supabase/server';

import { ASSETS_BUCKET } from '../../utils/storage';
import {
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

// Carries `download` because that is what Supabase appends for the option
// `exportDownloadOptions` passes, and `servesAsAttachment` reads it back. A
// fixture without it would have a refreshed record re-signed on every later
// read — a real regression the suite would not see.
const FRESH_URL =
  'https://storage.example/fresh-url?token=abc&download=proposals_export_123.csv';

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
      signedUrl: FRESH_URL,
    });
  });

  // Pinned against the bucket by name rather than against the export constant,
  // which would compare it to itself and hold whatever it was changed to.
  //
  // The literal is deliberately temporary. It was written when nothing
  // provisioned a bucket of their own, so a repoint would have silently lost
  // the feature per environment — but `services/db/migrate.ts` now creates and
  // re-asserts a private `exports` bucket and fails the deploy on a public one,
  // and its comment says the pipeline is repointed at it in a follow-up. When
  // that lands, this assertion is *expected* to fail: update the literal, do
  // not read the failure as evidence the repoint is wrong. The instance-scoped
  // path beside it is the part that keeps its value either way.
  it('signs against the configured bucket, at the instance-scoped path', async () => {
    vi.mocked(get).mockResolvedValue(expiredRecord());
    const storageFrom = vi.fn(() => ({ createSignedUrl }));
    vi.mocked(createSBServiceClient).mockReturnValue({
      storage: { from: storageFrom },
    } as never);

    await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(storageFrom).toHaveBeenCalledWith(ASSETS_BUCKET);
    expect(createSignedUrl).toHaveBeenCalledWith(
      exportFilePath(INSTANCE_ID, 'proposals_export_123.csv'),
      EXPORT_URL_TTL_SECONDS,
      { download: 'proposals_export_123.csv' },
    );
  });

  // A record cached before the attachment-disposition fix holds a URL minted
  // without `&download=`, still valid for up to EXPORT_URL_TTL_SECONDS. Gating
  // the re-sign on expiry alone leaves the reported bug live for that whole
  // window after deploy — the admin clicks Download CSV and Safari renders the
  // CSV inline exactly as before. A URL that cannot download is stale whatever
  // its expiry says.
  it('re-signs an unexpired URL that predates the download option', async () => {
    vi.mocked(get).mockResolvedValue({
      ...expiredRecord(),
      signedUrl: 'https://storage.example/pre-fix-url?token=abc',
      urlExpiresAt: new Date(NOW.getTime() + 60 * 60 * 1000).toISOString(),
    });

    const result = await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(createSignedUrl).toHaveBeenCalledWith(
      exportFilePath(INSTANCE_ID, 'proposals_export_123.csv'),
      EXPORT_URL_TTL_SECONDS,
      { download: 'proposals_export_123.csv' },
    );
    expect(result).toMatchObject({
      signedUrl: FRESH_URL,
    });
  });

  // Export objects live at `process/<instanceId>/proposals/<file>`, and the only
  // SELECT policy on the assets bucket requires the first path segment to equal
  // the caller's uid. So the anon-key client this used cannot even see the
  // object — `createSignedUrl` answers "Object not found" and the re-sign
  // silently no-ops. Authorization is already settled above by the ownership
  // check and `assertProfileAccess`, which is what lets the service client sign
  // here, exactly as `getProposal` and the resources signer do.
  it('signs with the service client, which RLS does not block', async () => {
    vi.mocked(get).mockResolvedValue(expiredRecord());

    await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(createSBServiceClient).toHaveBeenCalled();
    expect(createSBServerClient).not.toHaveBeenCalled();
  });

  // The re-sign is the whole of the rescue path for records cached before the
  // download option existed, so a failure that goes unlogged is a fix that
  // reports success while serving the inline URL it was meant to replace.
  it('reports a failed re-sign instead of failing quietly', async () => {
    vi.mocked(get).mockResolvedValue(expiredRecord());
    createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: 'Object not found' },
    });

    const result = await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to re-sign export URL',
      expect.objectContaining({ exportId: EXPORT_ID }),
    );
    // The stale URL is still returned — a dead link beats no link — but the
    // failure is now visible.
    expect(result).toMatchObject({
      signedUrl: 'https://storage.example/stale-url',
    });
  });

  // `createSBServiceClient` throws synchronously when SUPABASE_SERVICE_ROLE is
  // unset, which would otherwise escape the graceful-degradation branch above
  // and 500 the whole query. That costs the admin the Download CSV link
  // entirely: the button escalates to its error boundary and the only way back
  // is re-running the export. Losing the re-sign is survivable; losing the
  // record is not.
  it('keeps serving the record when the storage client cannot be built', async () => {
    vi.mocked(get).mockResolvedValue(expiredRecord());
    vi.mocked(createSBServiceClient).mockImplementation(() => {
      throw new Error('SUPABASE_SERVICE_ROLE is not set.');
    });

    const result = await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to re-sign export URL',
      expect.objectContaining({ exportId: EXPORT_ID }),
    );
    expect(result).toMatchObject({
      signedUrl: 'https://storage.example/stale-url',
    });
  });

  // A record with a file but no recorded expiry used to bail out of the re-sign
  // entirely, so the export stayed undownloadable for the rest of the record's
  // 24h life with the object sitting in the bucket the whole time. The workflow
  // always writes the expiry alongside the file name, so this is latent rather
  // than live — but it is the same hole this branch closes for `signedUrl`, and
  // an unknown expiry is not evidence of a working URL.
  it('re-signs a completed export with no recorded expiry', async () => {
    vi.mocked(get).mockResolvedValue({
      ...expiredRecord(),
      urlExpiresAt: undefined,
    });

    const result = await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(createSignedUrl).toHaveBeenCalled();
    expect(result).toMatchObject({ signedUrl: FRESH_URL });
  });

  // The sibling of the missing-expiry case: `new Date('garbage') < new Date()`
  // is false, so a corrupt expiry beside a download-carrying URL satisfied none
  // of the staleness tests and was never re-signed. An expiry that cannot be
  // read is no more evidence of a live URL than one that is absent.
  it('re-signs a completed export whose expiry cannot be parsed', async () => {
    vi.mocked(get).mockResolvedValue({
      ...expiredRecord(),
      signedUrl: FRESH_URL,
      urlExpiresAt: 'not-a-date',
    });

    await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(createSignedUrl).toHaveBeenCalled();
  });

  // A URL with seconds left is not worth handing over: it dies between this read
  // and the click, the browser shows a signature error, and the button has
  // already cleared its export id — so the link is gone and the only way back
  // is re-running the export.
  it('re-signs a URL that is about to expire', async () => {
    vi.mocked(get).mockResolvedValue({
      ...expiredRecord(),
      signedUrl: FRESH_URL,
      urlExpiresAt: new Date(NOW.getTime() + 5_000).toISOString(),
    });

    await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(createSignedUrl).toHaveBeenCalled();
  });

  // The cached record is an unvalidated cast over Redis JSON, so a non-string
  // `signedUrl` is reachable through schema drift or a corrupt entry. It has to
  // read as "cannot download" rather than throw: the staleness test runs outside
  // the degradation boundary, so a throw here would 500 the query and cost the
  // admin the record the boundary exists to preserve.
  it('treats a non-string cached URL as unusable rather than throwing', async () => {
    vi.mocked(get).mockResolvedValue({
      ...expiredRecord(),
      signedUrl: 42,
      urlExpiresAt: new Date(NOW.getTime() + 60 * 60 * 1000).toISOString(),
    });

    const result = await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(createSignedUrl).toHaveBeenCalled();
    expect(result).toMatchObject({ signedUrl: FRESH_URL });
  });

  // Completing the case above. Narrowing only stops the staleness test throwing;
  // a non-string that survives a *failed* re-sign is still handed back, and the
  // tRPC output schema declares `signedUrl: z.string().optional()` — so it is
  // rejected there instead, and the admin loses the record either way. Defending
  // the corrupt-cache case at all means dropping the value, not just reading
  // around it.
  it('drops a non-string cached URL even when the re-sign fails', async () => {
    vi.mocked(get).mockResolvedValue({
      ...expiredRecord(),
      signedUrl: 42,
      urlExpiresAt: new Date(NOW.getTime() + 60 * 60 * 1000).toISOString(),
    });
    createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: 'Object not found' },
    });

    const result = await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(result).toMatchObject({ status: 'completed' });
    expect((result as { signedUrl?: string }).signedUrl).toBeUndefined();
  });

  // The scrub has to cover every status, not just the one the re-sign handles.
  // A corrupt record that never completed reaches the caller untouched, and its
  // output schema rejects a non-string `signedUrl` just the same.
  it('drops a non-string cached URL on a record that never completed', async () => {
    vi.mocked(get).mockResolvedValue({
      ...expiredRecord(),
      status: 'processing',
      signedUrl: 42,
    });

    const result = await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect((result as { signedUrl?: string }).signedUrl).toBeUndefined();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  // `Date.parse` stringifies its argument, so a numeric expiry reads as the year
  // 2042 rather than NaN. Without the typeof guard a corrupt record beside a
  // download-carrying URL looked fresh for two decades and was never re-signed.
  it('re-signs when the expiry is not a string at all', async () => {
    vi.mocked(get).mockResolvedValue({
      ...expiredRecord(),
      signedUrl: FRESH_URL,
      urlExpiresAt: 42,
    });

    await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(createSignedUrl).toHaveBeenCalled();
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
        signedUrl: FRESH_URL,
      }),
      EXPORT_CACHE_TTL_SECONDS,
    );
  });

  // "Still valid" now means unexpired *and* able to download — the URL here
  // carries `download` for that reason. Without it the record would be re-signed
  // however long it had left, which is what rescues pre-fix cached records.
  it('leaves a still-valid URL alone', async () => {
    const liveUrl =
      'https://storage.example/live-url?token=abc&download=proposals_export_123.csv';
    vi.mocked(get).mockResolvedValue({
      ...expiredRecord(),
      signedUrl: liveUrl,
      urlExpiresAt: new Date(NOW.getTime() + 60 * 60 * 1000).toISOString(),
    });

    const result = await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(createSignedUrl).not.toHaveBeenCalled();
    expect(result).toMatchObject({ signedUrl: liveUrl });
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
      { download: 'proposals_export_123.csv' },
    );
    expect(result).toMatchObject({
      signedUrl: FRESH_URL,
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
