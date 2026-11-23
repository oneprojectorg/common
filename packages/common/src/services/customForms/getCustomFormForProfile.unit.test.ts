import { beforeEach, describe, expect, it, vi } from 'vitest';

// `@op/db/client` pulls in `server-only`, which Vitest can't load. Stub it with
// a fake `db` exposing the `customForms` query helper and the submission
// lookup this service uses.
const findMany = vi.fn();
const submissionLimit = vi.fn();

const selectBuilder = {
  from: () => selectBuilder,
  leftJoin: () => selectBuilder,
  where: () => selectBuilder,
  limit: () => submissionLimit(),
};

vi.mock('@op/db/client', () => ({
  db: {
    query: {
      customForms: {
        findMany: (...args: unknown[]) => findMany(...args),
      },
    },
    select: () => selectBuilder,
  },
  and: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => args,
  getTableColumns: (table: unknown) => table,
  inArray: (...args: unknown[]) => args,
  isNull: (...args: unknown[]) => args,
  or: (...args: unknown[]) => args,
}));

vi.mock('@op/db/schema', () => ({
  customFormSubmissions: {
    id: 'id',
    customFormId: 'custom_form_id',
    profileId: 'profile_id',
    deletedAt: 'deleted_at',
  },
  proposals: {
    profileId: 'profile_id',
    submittedByProfileId: 'submitted_by_profile_id',
  },
}));

const assertUserByAuthId = vi.fn();

vi.mock('../decision/assertDecisionProfileReadAccess', () => ({
  assertDecisionProfileReadAccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../assert', () => ({
  assertUserByAuthId: (...args: unknown[]) => assertUserByAuthId(...args),
}));

const { getCustomFormForProfile } = await import('./getCustomFormForProfile');

function form(schema: Record<string, unknown>, id = 'form') {
  return { id, profileId: 'p1', name: id, schema };
}

describe('getCustomFormForProfile', () => {
  beforeEach(() => {
    findMany.mockReset();
    submissionLimit.mockReset();
    assertUserByAuthId.mockReset();
    submissionLimit.mockResolvedValue([]);
    assertUserByAuthId.mockResolvedValue({
      profileId: 'caller',
      currentProfileId: 'caller',
    });
  });

  it('returns the form whose x-phase matches the requested phase', async () => {
    findMany.mockResolvedValue([
      form({ 'x-phase': 'submission' }, 'submit-form'),
      form({ 'x-phase': 'review' }, 'review-form'),
    ]);

    const result = await getCustomFormForProfile({
      profileId: 'p1',
      phaseId: 'review',
      initialPhaseId: 'submission',
      authUserId: 'auth-user',
    });

    expect(result?.id).toBe('review-form');
  });

  it('treats a form with no x-phase as the initial phase', async () => {
    findMany.mockResolvedValue([form({}, 'legacy-form')]);

    const result = await getCustomFormForProfile({
      profileId: 'p1',
      phaseId: 'submission',
      initialPhaseId: 'submission',
      authUserId: 'auth-user',
    });

    expect(result?.id).toBe('legacy-form');
  });

  it('returns null when no form applies to the phase', async () => {
    findMany.mockResolvedValue([form({ 'x-phase': 'submission' })]);

    const result = await getCustomFormForProfile({
      profileId: 'p1',
      phaseId: 'voting',
      initialPhaseId: 'submission',
      authUserId: 'auth-user',
    });

    expect(result).toBeNull();
    expect(submissionLimit).not.toHaveBeenCalled();
  });

  it('falls back to the first action form when no phaseId is given', async () => {
    findMany.mockResolvedValue([
      form({ 'x-phase': 'submission', 'x-show-on': 'entry' }, 'entry-form'),
      form({ 'x-phase': 'review' }, 'action-form'),
    ]);

    const result = await getCustomFormForProfile({
      profileId: 'p1',
      authUserId: 'auth-user',
    });

    expect(result?.id).toBe('action-form');
  });

  it('returns null when the caller already submitted the matched form', async () => {
    findMany.mockResolvedValue([form({ 'x-phase': 'submission' })]);
    submissionLimit.mockResolvedValue([
      {
        id: 'submission-row',
        customFormId: 'form',
        profileId: 'caller',
        data: { neighborhood: 'Downtown' },
      },
    ]);

    const result = await getCustomFormForProfile({
      profileId: 'p1',
      phaseId: 'submission',
      initialPhaseId: 'submission',
      authUserId: 'auth-user',
    });

    expect(result).toBeNull();
  });

  it('still returns the form when the caller has no profile to have answered with', async () => {
    findMany.mockResolvedValue([form({ 'x-phase': 'submission' })]);
    assertUserByAuthId.mockResolvedValue({
      profileId: null,
      currentProfileId: null,
    });

    const result = await getCustomFormForProfile({
      profileId: 'p1',
      phaseId: 'submission',
      initialPhaseId: 'submission',
      authUserId: 'auth-user',
    });

    expect(result?.id).toBe('form');
    expect(submissionLimit).not.toHaveBeenCalled();
  });

  it('defaults to action timing and returns an entry form only when asked at entry', async () => {
    findMany.mockResolvedValue([
      form({ 'x-phase': 'review', 'x-show-on': 'entry' }, 'entry-form'),
    ]);
    const input = {
      profileId: 'p1',
      phaseId: 'review',
      initialPhaseId: 'submission',
      authUserId: 'auth-user',
    };

    const [atAction, atEntry] = await Promise.all([
      getCustomFormForProfile(input),
      getCustomFormForProfile({ ...input, showOn: 'entry' }),
    ]);

    expect(atAction).toBeNull();
    expect(atEntry?.id).toBe('entry-form');
  });

  it('does not return an action form to a caller asking at phase entry', async () => {
    findMany.mockResolvedValue([form({ 'x-phase': 'review' }, 'action-form')]);

    const result = await getCustomFormForProfile({
      profileId: 'p1',
      phaseId: 'review',
      initialPhaseId: 'submission',
      showOn: 'entry',
      authUserId: 'auth-user',
    });

    expect(result).toBeNull();
  });
});
