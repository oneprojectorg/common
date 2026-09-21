import { beforeEach, describe, expect, it, vi } from 'vitest';

// `@op/db/client` pulls in `server-only`, which Vitest can't load. Stub it with
// a fake `db` exposing the `customForms` query helpers and the submission
// lookup this service uses.
const findFirst = vi.fn();
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
        findFirst: (...args: unknown[]) => findFirst(...args),
        findMany: (...args: unknown[]) => findMany(...args),
      },
    },
    select: () => selectBuilder,
  },
  and: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => args,
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

vi.mock('../assert', () => ({
  assertUserByAuthId: (...args: unknown[]) => assertUserByAuthId(...args),
}));

const { getCustomFormForProfile } = await import('./getCustomFormForProfile');

function form(schema: Record<string, unknown>, id = 'form') {
  return { id, profileId: 'p1', name: id, schema };
}

describe('getCustomFormForProfile', () => {
  beforeEach(() => {
    findFirst.mockReset();
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
    expect(findFirst).not.toHaveBeenCalled();
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

  it('falls back to the first form when no phaseId is given', async () => {
    findFirst.mockResolvedValue(form({ 'x-phase': 'review' }, 'first-form'));

    const result = await getCustomFormForProfile({
      profileId: 'p1',
      authUserId: 'auth-user',
    });

    expect(result?.id).toBe('first-form');
    expect(findMany).not.toHaveBeenCalled();
  });

  it('returns null when the caller already submitted the matched form', async () => {
    findMany.mockResolvedValue([form({ 'x-phase': 'submission' })]);
    submissionLimit.mockResolvedValue([{ id: 'submission-row' }]);

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
});
