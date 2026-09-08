import { beforeEach, describe, expect, it, vi } from 'vitest';

// Boundary mocks: requesting an analysis is orchestration over an instance
// lookup, the admin gate, a count, the status cache, and the event bus. We drive
// those and assert what it hands onward — the job it asks for, and the record
// the first status read will find.
vi.mock('@op/db/client', () => ({
  db: { select: vi.fn(), insert: vi.fn() },
  eq: vi.fn(),
}));

vi.mock('../access', () => ({ assertInstanceProfileAccess: vi.fn() }));

vi.mock('./themes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./themes')>()),
  readProposalsInScope: vi.fn(),
}));

import { db } from '@op/db/client';
import { Events, event } from '@op/events';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import { requestThemeAnalysis } from './requestThemeAnalysis';
import { THEME_ANALYSIS_MIN_PROPOSALS, readProposalsInScope } from './themes';

const INSTANCE_ID = '22222222-2222-4222-8222-222222222222';
const PROFILE_ID = '44444444-4444-4444-8444-444444444444';
const AUTH_USER_ID = '33333333-3333-4333-8333-333333333333';

const user = { id: AUTH_USER_ID } as User;

const sendEvent = vi.fn();

const instanceRowIs = (rows: Array<{ profileId: string | null }>) => {
  vi.mocked(db.select).mockReturnValue({
    from: () => ({ where: () => ({ limit: async () => rows }) }),
  } as never);
};

const scopeHolds = (total: number) => {
  vi.mocked(readProposalsInScope).mockResolvedValue({ proposals: [], total });
};

const inserted = vi.fn();

const insertReturns = (rows: Array<{ id: string }>) => {
  vi.mocked(db.insert).mockReturnValue({
    values: (row: unknown) => {
      inserted(row);
      return { returning: async () => rows };
    },
  } as never);
};

const ANALYSIS_ID = '55555555-5555-4555-8555-555555555555';

beforeEach(() => {
  vi.clearAllMocks();
  instanceRowIs([{ profileId: PROFILE_ID }]);
  scopeHolds(10);
  insertReturns([{ id: ANALYSIS_ID }]);
  vi.spyOn(event, 'send').mockImplementation(sendEvent);
});

const request = (scope?: 'phase' | 'process') =>
  requestThemeAnalysis({
    input: { processInstanceId: INSTANCE_ID, ...(scope && { scope }) },
    user,
  });

describe('requestThemeAnalysis', () => {
  // The payload is asserted whole rather than by naming keys that should be
  // absent: a filter put back by way of a spread adds a key nobody thought to
  // write a test for, and only an exact match notices that.
  it('tells the job which instance and nothing about the caller"s view', async () => {
    const { analysisId } = await request();

    const [payload] = sendEvent.mock.calls[0] as [
      { name: string; data: Record<string, unknown> },
    ];

    expect(payload.name).toBe(Events.proposalThemeAnalysisRequested.name);
    expect(payload.data).toEqual({
      analysisId,
      processInstanceId: INSTANCE_ID,
      userId: AUTH_USER_ID,
      scope: 'phase',
    });
  });

  // The scope decides which proposals the run reads, and the surface that
  // launched it is the only thing that knows which set it was showing.
  it('carries the caller"s scope to the job', async () => {
    await request('process');

    const [payload] = sendEvent.mock.calls[0] as [{ data: { scope: string } }];

    expect(payload.data.scope).toBe('process');
  });

  // Counted in the scope the run will read, or a results-scoped analysis could
  // be refused for a current phase that happens to be empty.
  it('counts in the scope it was asked for', async () => {
    await request('process');

    expect(vi.mocked(readProposalsInScope)).toHaveBeenCalledWith({
      processInstanceId: INSTANCE_ID,
      userId: AUTH_USER_ID,
      scope: 'process',
      limit: 1,
    });
  });

  // The id the caller polls on is the row's, so the workflow's updates and the
  // client's reads cannot land on different records.
  it('returns the id the database minted', async () => {
    await expect(request()).resolves.toEqual({ analysisId: ANALYSIS_ID });
  });

  // A row, not a cache entry: `@op/cache` writes are a silent no-op without
  // `REDIS_URL`, so the job would run, spend two model calls, and leave the
  // caller waiting on a record nothing had written.
  it('inserts a pending row the status read can act on', async () => {
    await request();

    expect(inserted).toHaveBeenCalledWith({
      processInstanceId: INSTANCE_ID,
      requestedByAuthUserId: AUTH_USER_ID,
      status: 'pending',
    });
  });

  it('starts no job when the insert reports no row', async () => {
    insertReturns([]);

    await expect(request()).rejects.toBeInstanceOf(CommonError);
    expect(sendEvent).not.toHaveBeenCalled();
  });

  // An analysis reads every proposal in the phase, including any hidden from the
  // public, so it stays with admins of the decision profile itself rather than
  // with anyone holding an org-level grant over it. Passing the real
  // `ownerProfileId` here would widen that.
  it('gates on decision admin of the owning profile, with no org fallback', async () => {
    await request();

    expect(vi.mocked(assertInstanceProfileAccess)).toHaveBeenCalledWith({
      user,
      instance: { profileId: PROFILE_ID, ownerProfileId: null },
      profilePermissions: { decisions: permission.ADMIN },
      orgFallbackPermissions: { decisions: permission.ADMIN },
    });
  });

  it('starts nothing when the caller is not an admin', async () => {
    vi.mocked(assertInstanceProfileAccess).mockRejectedValueOnce(
      new UnauthorizedError("You don't have access to do this"),
    );

    await expect(request()).rejects.toBeInstanceOf(UnauthorizedError);
    expect(sendEvent).not.toHaveBeenCalled();
    expect(inserted).not.toHaveBeenCalled();
  });

  it('reports a missing instance rather than gating on nothing', async () => {
    instanceRowIs([]);

    await expect(request()).rejects.toBeInstanceOf(NotFoundError);
    expect(vi.mocked(assertInstanceProfileAccess)).not.toHaveBeenCalled();
  });

  // Common ground between one proposal and nothing is that proposal, and the
  // pass costs the same as a real one. Refused here so the facilitator gets an
  // answer instead of a job that fails a minute later.
  it('refuses a phase with too few proposals to compare', async () => {
    scopeHolds(THEME_ANALYSIS_MIN_PROPOSALS - 1);

    await expect(request()).rejects.toBeInstanceOf(ValidationError);
    expect(sendEvent).not.toHaveBeenCalled();
  });

  it('accepts a phase holding exactly the minimum', async () => {
    scopeHolds(THEME_ANALYSIS_MIN_PROPOSALS);

    await expect(request()).resolves.toEqual({ analysisId: ANALYSIS_ID });
  });

  // The count check must not read the corpus: it runs on every press, and the
  // corpus read is the expensive part of the job.
  it('reads one row for the count', async () => {
    await request();

    expect(vi.mocked(readProposalsInScope)).toHaveBeenCalledWith({
      processInstanceId: INSTANCE_ID,
      userId: AUTH_USER_ID,
      scope: 'phase',
      limit: 1,
    });
  });
});
