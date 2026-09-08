import { beforeEach, describe, expect, it, vi } from 'vitest';

// Boundary mocks: reading a status is orchestration over the row and the access
// gate. These drive both and assert what reaches the caller — whether a row is
// reported at all, and whether the boundary was re-asserted on the way out.
vi.mock('@op/db/client', () => ({
  db: { query: { proposalThemeAnalyses: { findFirst: vi.fn() } } },
}));

vi.mock('../access', () => ({ assertInstanceProfileAccess: vi.fn() }));

vi.mock('@op/logging', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
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

const row = (overrides: Record<string, unknown> = {}) => ({
  id: ANALYSIS_ID,
  processInstanceId: INSTANCE_ID,
  requestedByAuthUserId: AUTH_USER_ID,
  status: 'pending',
  result: null,
  analyzedCount: null,
  total: null,
  errorCode: null,
  errorMessage: null,
  createdAt: '2026-09-08T12:00:00.000Z',
  completedAt: null,
  processInstance: { profileId: PROFILE_ID },
  ...overrides,
});

const storedRowIs = (value: unknown) => {
  vi.mocked(db.query.proposalThemeAnalyses.findFirst).mockResolvedValue(
    value as never,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  storedRowIs(row());
});

const read = () => getThemeAnalysisStatus({ analysisId: ANALYSIS_ID, user });

describe('getThemeAnalysisStatus', () => {
  it('returns the run as the client contract shapes it', async () => {
    await expect(read()).resolves.toEqual({
      analysisId: ANALYSIS_ID,
      processInstanceId: INSTANCE_ID,
      userId: AUTH_USER_ID,
      status: 'pending',
      createdAt: '2026-09-08T12:00:00.000Z',
    });
  });

  // The whole point of the run: what the two passes produced has to come back
  // out, with the coverage the dialog states beside it.
  it('carries a completed run"s result and counts through', async () => {
    storedRowIs(
      row({
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
    storedRowIs(
      row({
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
    storedRowIs(undefined);

    await expect(read()).resolves.toEqual({ status: 'not_found' });
  });

  // `result` is jsonb, so nothing between the write and this read checks its
  // shape — a row written by an older deploy is a real possibility.
  it('reports a row whose result does not match the schema as not found', async () => {
    storedRowIs(
      row({ status: 'completed', result: { themes: 'not an array' } }),
    );

    await expect(read()).resolves.toEqual({ status: 'not_found' });
  });

  it('refuses a caller who does not own the analysis', async () => {
    storedRowIs(row({ requestedByAuthUserId: 'someone-else' }));

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

  // The foreign key cascades, so this should be unreachable — but the join is
  // what authorization reads, and answering an authorization question with a
  // missing record is worse than saying the instance is gone.
  it('reports a row whose instance is gone', async () => {
    storedRowIs(row({ processInstance: null }));

    await expect(read()).rejects.toBeInstanceOf(NotFoundError);
  });

  it('checks ownership before it asks about access', async () => {
    storedRowIs(row({ requestedByAuthUserId: 'someone-else' }));

    await expect(read()).rejects.toBeInstanceOf(UnauthorizedError);
    expect(vi.mocked(assertInstanceProfileAccess)).not.toHaveBeenCalled();
  });
});
