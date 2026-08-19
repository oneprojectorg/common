import { beforeEach, describe, expect, it, vi } from 'vitest';

// Boundary mocks: getExportStatus is orchestration over the durable export
// record, the access gate, and Supabase storage. We drive those and assert
// what it does with a completed export whose signed URL has lapsed — the
// refresh path that was unreachable before the record outlived the URL.
vi.mock('@op/db/client', () => ({
  db: {
    query: { proposalExports: { findFirst: vi.fn() } },
    update: vi.fn(),
  },
  eq: vi.fn(),
}));

vi.mock('@op/supabase/server', () => ({
  createSBServerClient: vi.fn(),
}));

vi.mock('../assert', () => ({
  assertProfileAccess: vi.fn(),
}));

import { db } from '@op/db/client';
import { ProposalExportStatus } from '@op/db/schema';
import { createSBServerClient } from '@op/supabase/server';

import { UnauthorizedError } from '../../utils';
import { ASSETS_BUCKET } from '../../utils/storage';
import { assertProfileAccess } from '../assert';
import { EXPORT_URL_TTL_SECONDS, exportFilePath } from './exports';
import { getExportStatus } from './getExportStatus';

const EXPORT_ID = '11111111-1111-4111-8111-111111111111';
const INSTANCE_ID = '22222222-2222-4222-8222-222222222222';
const AUTH_USER_ID = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-08-10T12:00:00.000Z');

const user = { id: AUTH_USER_ID } as never;
const logger = { info: vi.fn(), warn: vi.fn() };

const createSignedUrl = vi.fn();
const updateSet = vi.fn(() => ({ where: async () => undefined }));

/** Shape of a `proposalExports` row, widened to match the nullable columns
 * `expiredRow()` seeds — a bare object-literal return type would infer each
 * nullable field as the literal it happens to be seeded with, rejecting a
 * test's `null` override of a field seeded non-null (or vice versa). */
interface ExpiredExportRow {
  id: string;
  processInstanceId: string;
  requestedByUserId: string | null;
  format: string;
  status: ProposalExportStatus;
  fileName: string | null;
  signedUrl: string | null;
  urlExpiresAt: Date;
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date;
}

/** A completed export row whose signed URL lapsed an hour ago. */
const expiredRow = (): ExpiredExportRow => ({
  id: EXPORT_ID,
  processInstanceId: INSTANCE_ID,
  requestedByUserId: AUTH_USER_ID,
  format: 'csv',
  status: ProposalExportStatus.COMPLETED,
  fileName: 'proposals_export_123.csv',
  signedUrl: 'https://storage.example/stale-url',
  urlExpiresAt: new Date(NOW.getTime() - 60 * 60 * 1000),
  errorMessage: null,
  createdAt: new Date(NOW.getTime() - 3 * 60 * 60 * 1000),
  completedAt: new Date(NOW.getTime() - 3 * 60 * 60 * 1000),
});

/** Stubs the single `db.query.proposalExports.findFirst` call, joined to a
 * process instance whose profile is `profile-1`. */
const setupRow = (row: ExpiredExportRow | null) => {
  vi.mocked(db.query.proposalExports.findFirst).mockResolvedValue(
    (row
      ? { ...row, processInstance: { profileId: 'profile-1' } }
      : undefined) as never,
  );
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);

  updateSet.mockImplementation(() => ({ where: async () => undefined }));
  vi.mocked(db.update).mockReturnValue({ set: updateSet } as never);

  createSignedUrl.mockResolvedValue({
    data: { signedUrl: 'https://storage.example/fresh-url' },
    error: null,
  });
  vi.mocked(createSBServerClient).mockResolvedValue({
    storage: { from: () => ({ createSignedUrl }) },
  } as never);
});

describe('getExportStatus', () => {
  it('returns not_found when no record exists', async () => {
    setupRow(null);

    const result = await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(result).toEqual({ status: 'not_found' });
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it('re-signs a completed export whose URL has expired', async () => {
    setupRow(expiredRow());

    const result = await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(result).toMatchObject({
      signedUrl: 'https://storage.example/fresh-url',
    });
  });

  // Pinned against the shared bucket by name rather than against the export
  // constant, which would compare it to itself and hold whatever it was
  // changed to. Repointing exports at a bucket of their own is what this has
  // to catch: it reads as a security improvement, but nothing in the
  // repository provisions such a bucket, so every hosted environment silently
  // loses the feature until someone creates it by hand. That is why exports
  // share the public bucket, and why the unguessable file name — not the
  // signature — is what limits access to them.
  it('signs against the shared public bucket, at the instance-scoped path', async () => {
    setupRow(expiredRow());
    const storageFrom = vi.fn(() => ({ createSignedUrl }));
    vi.mocked(createSBServerClient).mockResolvedValue({
      storage: { from: storageFrom },
    } as never);

    await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(storageFrom).toHaveBeenCalledWith(ASSETS_BUCKET);
    expect(createSignedUrl).toHaveBeenCalledWith(
      exportFilePath(INSTANCE_ID, 'proposals_export_123.csv'),
      EXPORT_URL_TTL_SECONDS,
    );
  });

  // The original bug: the recorded expiry claimed 24h while the URL itself was
  // minted for 2h, so callers trusted a link that had been dead for 22 hours.
  // The durable record has no TTL of its own now, but the recorded expiry must
  // still match the signed URL it was just minted alongside.
  it('records an expiry that matches the URL it just minted', async () => {
    setupRow(expiredRow());

    const result = await getExportStatus({ exportId: EXPORT_ID, user, logger });

    const signedFor = vi.mocked(createSignedUrl).mock.calls[0]?.[1];
    expect(signedFor).toBe(EXPORT_URL_TTL_SECONDS);

    const recordedExpiry = new Date(
      (result as { urlExpiresAt: string }).urlExpiresAt,
    );
    expect(recordedExpiry.getTime()).toBe(NOW.getTime() + signedFor * 1000);
  });

  it('writes the refreshed URL back onto the durable record', async () => {
    setupRow(expiredRow());

    await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(db.update).toHaveBeenCalled();
    expect(updateSet).toHaveBeenCalledWith({
      signedUrl: 'https://storage.example/fresh-url',
      urlExpiresAt: expect.any(Date),
    });
  });

  it('leaves a still-valid URL alone', async () => {
    setupRow({
      ...expiredRow(),
      signedUrl: 'https://storage.example/live-url',
      urlExpiresAt: new Date(NOW.getTime() + 60 * 60 * 1000),
    });

    const result = await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(createSignedUrl).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
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
    setupRow({
      ...expiredRow(),
      signedUrl: null,
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
    setupRow({
      ...expiredRow(),
      status: ProposalExportStatus.FAILED,
      fileName: null,
      signedUrl: null,
      errorMessage: 'Storage upload failed',
    });

    await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it('rejects a caller who does not own the export', async () => {
    setupRow({
      ...expiredRow(),
      requestedByUserId: 'someone-else',
    });

    await expect(
      getExportStatus({ exportId: EXPORT_ID, user, logger }),
    ).rejects.toThrow();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  // `requestedByUserId` is `ON DELETE SET NULL`: once the requesting account
  // is deleted, no caller could ever match it, so a hard rejection here would
  // make an otherwise-complete, durable export permanently unrecoverable —
  // exactly the failure mode this table was built to eliminate. The caller's
  // standing access to the decision profile is what should govern instead.
  it('falls through to the profile check when the export has no attributed requester', async () => {
    setupRow({
      ...expiredRow(),
      requestedByUserId: null,
    });

    const result = await getExportStatus({ exportId: EXPORT_ID, user, logger });

    expect(assertProfileAccess).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: 'profile-1' }),
    );
    expect(result).toMatchObject({ userId: null });
  });

  it('still rejects a caller without profile access when the export has no attributed requester', async () => {
    setupRow({
      ...expiredRow(),
      requestedByUserId: null,
    });
    vi.mocked(assertProfileAccess).mockRejectedValue(
      new UnauthorizedError('Not authorized'),
    );

    await expect(
      getExportStatus({ exportId: EXPORT_ID, user, logger }),
    ).rejects.toThrow();
  });
});
