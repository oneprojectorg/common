import { beforeEach, describe, expect, it, vi } from 'vitest';

// Boundary mocks: requesting an analysis is orchestration over an instance
// lookup, the admin gate, a count, the status cache, and the event bus. We drive
// those and assert what it hands onward — the job it asks for, and the record
// the first status read will find.
vi.mock('@op/cache', () => ({ set: vi.fn(), getWithStatus: vi.fn() }));

vi.mock('@op/db/client', () => ({
  db: { select: vi.fn() },
  eq: vi.fn(),
}));

vi.mock('../access', () => ({ assertInstanceProfileAccess: vi.fn() }));

vi.mock('./themes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./themes')>()),
  readProposalsInScope: vi.fn(),
}));

import { getWithStatus, set } from '@op/cache';
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

// The seed read-back. A hit means the write landed; anything else means the
// cache is not there, which is the case this guard exists for.
const cacheAnswers = (status: 'hit' | 'miss' | 'timeout' | 'error') => {
  vi.mocked(getWithStatus).mockResolvedValue(
    (status === 'hit' ? { status, data: {} } : { status }) as never,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  instanceRowIs([{ profileId: PROFILE_ID }]);
  scopeHolds(10);
  cacheAnswers('hit');
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

  // Every request is its own analysis: two presses give two ids under two keys,
  // and neither overwrites the other.
  it('gives each request its own id and key', async () => {
    const first = await request();
    const second = await request();

    expect(first.analysisId).not.toBe(second.analysisId);

    const [[firstKey], [secondKey]] = vi.mocked(set).mock.calls as [
      [string],
      [string],
    ];

    expect(firstKey).not.toBe(secondKey);
  });

  // Namespaced by instance and scope, so a phase run and a process run of the
  // same instance live apart rather than being told apart only by a UUID.
  it('keys the record by instance, scope and id', async () => {
    const { analysisId } = await request('process');

    const [key] = vi.mocked(set).mock.calls[0] as [string];

    expect(key).toBe(`themeAnalysis:${INSTANCE_ID}:process:${analysisId}`);
  });

  // The cache is the only store, so nothing else can supply what the seed omits
  // — and the status read checks ownership before anything else.
  it('seeds a record the first status read can act on', async () => {
    const { analysisId } = await request();

    const [, record] = vi.mocked(set).mock.calls[0] as [string, unknown];

    expect(record).toEqual({
      analysisId,
      processInstanceId: INSTANCE_ID,
      userId: AUTH_USER_ID,
      status: 'pending',
      createdAt: expect.any(String),
    });
  });

  // `set` reports nothing: it returns early with no cache configured and
  // swallows its own timeouts. Without the read-back the request would accept
  // the job, spend two model passes, and hand back an id for a record that was
  // never stored — which the client reads as still pending, so the button spins
  // until it reports a timeout for an analysis that succeeded.
  it.each(['miss', 'timeout', 'error'] as const)(
    'refuses the request when the seed read-back reports %s',
    async (status) => {
      cacheAnswers(status);

      await expect(request()).rejects.toBeInstanceOf(CommonError);
      expect(sendEvent).not.toHaveBeenCalled();
    },
  );

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
    expect(vi.mocked(set)).not.toHaveBeenCalled();
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

    await expect(request()).resolves.toEqual({
      analysisId: expect.any(String),
    });
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
