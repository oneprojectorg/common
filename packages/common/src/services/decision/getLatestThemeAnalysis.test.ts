import { beforeEach, describe, expect, it, vi } from 'vitest';

// Boundary mocks: reading the latest analysis is an instance lookup, the admin
// gate, and one snapshot read. We drive those and assert what comes back.
vi.mock('@op/db/client', () => ({
  db: { select: vi.fn() },
  eq: vi.fn(),
}));

vi.mock('../access', () => ({ assertInstanceProfileAccess: vi.fn() }));

vi.mock('./themes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./themes')>()),
  readLatestThemeAnalysis: vi.fn(),
}));

import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';

import { assertInstanceProfileAccess } from '../access';
import { getLatestThemeAnalysis } from './getLatestThemeAnalysis';
import { readLatestThemeAnalysis } from './themes';

const INSTANCE_ID = '11111111-1111-4111-8111-111111111111';
const PROFILE_ID = '22222222-2222-4222-8222-222222222222';
const AUTH_USER_ID = '33333333-3333-4333-8333-333333333333';

const user = { id: AUTH_USER_ID } as User;

const snapshot = {
  status: 'ready' as const,
  processInstanceId: INSTANCE_ID,
  scope: 'phase' as const,
  result: { themes: [], commonGround: [], outliers: [], suggestions: [] },
  analyzedCount: 4,
  total: 4,
  fingerprint: 'abc',
  completedAt: '2026-01-01T00:00:00.000Z',
};

const instanceRowIs = (rows: Array<{ profileId: string | null }>) => {
  vi.mocked(db.select).mockReturnValue({
    from: () => ({ where: () => ({ limit: async () => rows }) }),
  } as never);
};

const read = () =>
  getLatestThemeAnalysis({
    processInstanceId: INSTANCE_ID,
    scope: 'phase',
    user,
  });

beforeEach(() => {
  vi.clearAllMocks();
  instanceRowIs([{ profileId: PROFILE_ID }]);
  vi.mocked(readLatestThemeAnalysis).mockResolvedValue({
    status: 'hit',
    snapshot,
  });
});

describe('getLatestThemeAnalysis', () => {
  it('returns the stored snapshot to a decision admin', async () => {
    await expect(read()).resolves.toEqual(snapshot);

    // The same boundary as starting a run: decision admin on the owning
    // profile, with no org-level owner fallback.
    expect(vi.mocked(assertInstanceProfileAccess)).toHaveBeenCalledWith(
      expect.objectContaining({
        user,
        instance: { profileId: PROFILE_ID, ownerProfileId: null },
      }),
    );
    expect(vi.mocked(readLatestThemeAnalysis)).toHaveBeenCalledWith({
      processInstanceId: INSTANCE_ID,
      scope: 'phase',
    });
  });

  it('reports not_found when nothing is stored', async () => {
    vi.mocked(readLatestThemeAnalysis).mockResolvedValue({ status: 'miss' });

    await expect(read()).resolves.toEqual({ status: 'not_found' });
  });

  // A cache that did not answer is not an empty cache. Reporting it as one
  // would have the client offer a fresh run over a stored analysis.
  it('throws rather than reporting not_found when the cache did not answer', async () => {
    vi.mocked(readLatestThemeAnalysis).mockResolvedValue({
      status: 'unavailable',
    });

    await expect(read()).rejects.toThrow('Could not read the analysis.');
  });

  it('checks access before touching the cache', async () => {
    vi.mocked(assertInstanceProfileAccess).mockRejectedValueOnce(
      new Error('nope'),
    );

    await expect(read()).rejects.toThrow('nope');
    expect(vi.mocked(readLatestThemeAnalysis)).not.toHaveBeenCalled();
  });

  it('reports a missing instance', async () => {
    instanceRowIs([]);

    await expect(read()).rejects.toThrow(/Process instance/);
  });
});
