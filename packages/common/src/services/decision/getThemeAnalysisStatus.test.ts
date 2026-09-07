import { beforeEach, describe, expect, it, vi } from 'vitest';

// Boundary mocks: reading a status is orchestration over the cache, the
// instance lookup, and the access gate. These drive all three and assert what
// reaches the caller — which of the two "no record" answers, and whether the
// boundary re-asserted on the way out.
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
import { themeAnalysisCacheKey } from './themes';

const ANALYSIS_ID = '11111111-1111-4111-8111-111111111111';
const INSTANCE_ID = '22222222-2222-4222-8222-222222222222';
const PROFILE_ID = '44444444-4444-4444-8444-444444444444';
const AUTH_USER_ID = '33333333-3333-4333-8333-333333333333';

const user = { id: AUTH_USER_ID } as User;

const pendingRecord = {
  analysisId: ANALYSIS_ID,
  processInstanceId: INSTANCE_ID,
  userId: AUTH_USER_ID,
  status: 'pending' as const,
  createdAt: '2026-08-10T12:00:00.000Z',
};

const cacheAnswers = (answer: { status: string; data?: unknown }) => {
  vi.mocked(getWithStatus).mockResolvedValue(answer as never);
};

const instanceRowIs = (rows: Array<{ profileId: string | null }>) => {
  vi.mocked(db.select).mockReturnValue({
    from: () => ({ where: () => ({ limit: async () => rows }) }),
  } as never);
};

beforeEach(() => {
  vi.clearAllMocks();
  cacheAnswers({ status: 'hit', data: pendingRecord });
  instanceRowIs([{ profileId: PROFILE_ID }]);
});

const read = () => getThemeAnalysisStatus({ analysisId: ANALYSIS_ID, user });

describe('getThemeAnalysisStatus', () => {
  it('reads the record under the shared key', async () => {
    await read();

    expect(vi.mocked(getWithStatus)).toHaveBeenCalledWith(
      themeAnalysisCacheKey(ANALYSIS_ID),
    );
  });

  it('returns a parsed record', async () => {
    await expect(read()).resolves.toEqual(pendingRecord);
  });

  it('carries a completed run"s result and counts through', async () => {
    const result = {
      themes: [{ title: 'T', summary: 'S', proposals: [] }],
      commonGround: [],
      outliers: [],
      suggestions: [],
    };

    cacheAnswers({
      status: 'hit',
      data: {
        ...pendingRecord,
        status: 'completed',
        result,
        analyzedCount: 3,
        total: 5,
        completedAt: '2026-08-10T12:01:00.000Z',
      },
    });

    const record = await read();

    expect(record).toMatchObject({ result, analyzedCount: 3, total: 5 });
  });

  it('reports a cache miss as not found', async () => {
    cacheAnswers({ status: 'miss' });

    await expect(read()).resolves.toEqual({ status: 'not_found' });
  });

  // The client retires the analysis id when it reads `not_found`. Collapsing
  // these two would let one Redis timeout discard a run that is still working,
  // and the toast beside it would point at a control no longer on screen.
  it.each(['timeout', 'error'])(
    'refuses to call a cache %s a missing record',
    async (status) => {
      cacheAnswers({ status });

      await expect(read()).rejects.toBeInstanceOf(CommonError);
    },
  );

  // Reachable: the workflow patches by merging over the copy it reads, so an
  // eviction between the seed and a patch leaves a record holding a status and
  // nothing else. No later read repairs it.
  it('reports a record that does not match its schema as not found', async () => {
    cacheAnswers({ status: 'hit', data: { status: 'processing' } });

    await expect(read()).resolves.toEqual({ status: 'not_found' });
  });

  it('refuses a caller who does not own the analysis', async () => {
    cacheAnswers({
      status: 'hit',
      data: { ...pendingRecord, userId: 'someone-else' },
    });

    await expect(read()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  // The record outlives the role that produced it by up to a day, which is why
  // the boundary is re-asserted on every read rather than trusted from the
  // request.
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
      new UnauthorizedError("You don't have access to do this"),
    );

    await expect(read()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('reports a record naming an instance that is gone', async () => {
    instanceRowIs([]);

    await expect(read()).rejects.toBeInstanceOf(NotFoundError);
  });
});
