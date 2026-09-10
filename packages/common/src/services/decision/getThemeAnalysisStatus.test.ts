import { beforeEach, describe, expect, it, vi } from 'vitest';

// Boundary mocks: reading a status is orchestration over the row and the access
// gate. These drive both and assert what reaches the caller — whether a row is
// reported at all, and whether the boundary was re-asserted on the way out.
vi.mock('@op/cache', () => ({ getWithStatus: vi.fn() }));

vi.mock('@op/db/client', () => ({
  db: { select: vi.fn() },
  eq: vi.fn(),
}));

vi.mock('../access', () => ({ assertInstanceProfileAccess: vi.fn() }));

vi.mock('@op/logging', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { getWithStatus } from '@op/cache';
import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import { getThemeAnalysisStatus } from './getThemeAnalysisStatus';

const ANALYSIS_ID = '11111111-1111-4111-8111-111111111111';
const INSTANCE_ID = '22222222-2222-4222-8222-222222222222';
const PROFILE_ID = '44444444-4444-4444-8444-444444444444';
const AUTH_USER_ID = '33333333-3333-4333-8333-333333333333';

const user = { id: AUTH_USER_ID } as User;

const result = {
  themes: [{ title: 'Street space', summary: 'Road space.', proposals: [] }],
  commonGround: [],
  outliers: [],
  suggestions: [],
};

const record = (overrides: Record<string, unknown> = {}) => ({
  analysisId: ANALYSIS_ID,
  processInstanceId: INSTANCE_ID,
  userId: AUTH_USER_ID,
  status: 'pending',
  createdAt: '2026-09-08T12:00:00.000Z',
  ...overrides,
});

const storedRecordIs = (data: unknown) => {
  vi.mocked(getWithStatus).mockResolvedValue({ status: 'hit', data } as never);
};

const cacheAnswers = (status: 'miss' | 'timeout' | 'error') => {
  vi.mocked(getWithStatus).mockResolvedValue({ status } as never);
};

const instanceRowIs = (rows: Array<{ profileId: string | null }>) => {
  vi.mocked(db.select).mockReturnValue({
    from: () => ({ where: () => ({ limit: async () => rows }) }),
  } as never);
};

beforeEach(() => {
  vi.clearAllMocks();
  storedRecordIs(record());
  instanceRowIs([{ profileId: PROFILE_ID }]);
});

const read = () =>
  getThemeAnalysisStatus({
    analysisId: ANALYSIS_ID,
    processInstanceId: INSTANCE_ID,
    scope: 'phase',
    user,
  });

describe('getThemeAnalysisStatus', () => {
  // The instance and the scope are part of the key, so an id alone does not name
  // a run — and a phase run and a process run of one instance must not collide.
  it('reads the key the instance, scope and id name', async () => {
    await read();

    expect(vi.mocked(getWithStatus)).toHaveBeenCalledWith(
      `themeAnalysis:${INSTANCE_ID}:phase:${ANALYSIS_ID}`,
    );
  });

  it('returns the run as the client contract shapes it', async () => {
    await expect(read()).resolves.toEqual(record());
  });

  // The whole point of the run: what the two passes produced has to come back
  // out, with the coverage the dialog states beside it.
  it('carries a completed run"s result and counts through', async () => {
    storedRecordIs(
      record({
        status: 'completed',
        result,
        analyzedCount: 3,
        total: 5,
        completedAt: '2026-09-08T12:01:00.000Z',
      }),
    );

    await expect(read()).resolves.toMatchObject({
      status: 'completed',
      result,
      analyzedCount: 3,
      total: 5,
    });
  });

  // The code is what the app translates; the message is the English diagnostic
  // that stays in the log and the row.
  it('carries a failed run"s code and message through', async () => {
    storedRecordIs(
      record({
        status: 'failed',
        errorCode: 'not-enough-text',
        errorMessage: 'Only 1 of this phase"s 5 proposals have any text.',
      }),
    );

    await expect(read()).resolves.toMatchObject({
      status: 'failed',
      errorCode: 'not-enough-text',
    });
  });

  it('reports an unknown analysis as not found', async () => {
    cacheAnswers('miss');

    await expect(read()).resolves.toEqual({ status: 'not_found' });
  });

  // The client retires the analysis id when it reads `not_found`, so collapsing
  // these two would let one cache timeout discard a run that is still working.
  it.each(['timeout', 'error'] as const)(
    'refuses to call a cache %s a missing record',
    async (status) => {
      cacheAnswers(status);

      await expect(read()).rejects.toBeInstanceOf(CommonError);
    },
  );

  // Reachable: the workflow writes whole records, but an eviction between the
  // seed and a later write leaves one holding a status and nothing else. No
  // later read repairs it.
  it('reports a record that does not match its schema as not found', async () => {
    storedRecordIs({ status: 'processing' });

    await expect(read()).resolves.toEqual({ status: 'not_found' });
  });

  it('refuses a caller who does not own the analysis', async () => {
    storedRecordIs(record({ userId: 'someone-else' }));

    await expect(read()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  // The row outlives the role that produced it, which is why the boundary is
  // re-asserted on every read rather than trusted from the request.
  it('re-asserts decision admin on the owning profile, with no org fallback', async () => {
    await read();

    expect(vi.mocked(assertInstanceProfileAccess)).toHaveBeenCalledWith({
      user,
      instance: { profileId: PROFILE_ID, ownerProfileId: null },
      profilePermissions: { decisions: permission.ADMIN },
      orgFallbackPermissions: { decisions: permission.ADMIN },
    });
  });

  it('refuses a caller who has since lost decision admin', async () => {
    vi.mocked(assertInstanceProfileAccess).mockRejectedValueOnce(
      new UnauthorizedError("You don\'t have access to do this"),
    );

    await expect(read()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  // Nothing cascades a cache entry when its instance is deleted, so a record can
  // outlive the instance it names — and the instance is what authorization
  // reads.
  it('reports a record whose instance is gone', async () => {
    instanceRowIs([]);

    await expect(read()).rejects.toBeInstanceOf(NotFoundError);
  });

  it('checks ownership before it asks about access', async () => {
    storedRecordIs(record({ userId: 'someone-else' }));

    await expect(read()).rejects.toBeInstanceOf(UnauthorizedError);
    expect(vi.mocked(assertInstanceProfileAccess)).not.toHaveBeenCalled();
  });
});
