import { beforeEach, describe, expect, it, vi } from 'vitest';

// `@op/db/client` pulls in `server-only`, which Vitest can't load. Stub it with
// a fake `db` exposing just the `customForms` query helpers this service uses.
const findFirst = vi.fn();
const findMany = vi.fn();

vi.mock('@op/db/client', () => ({
  db: {
    query: {
      customForms: {
        findFirst: (...args: unknown[]) => findFirst(...args),
        findMany: (...args: unknown[]) => findMany(...args),
      },
    },
  },
}));

import { getCustomFormForProfile } from './getCustomFormForProfile';

function form(schema: Record<string, unknown>, id = 'form') {
  return { id, profileId: 'p1', name: id, schema };
}

describe('getCustomFormForProfile', () => {
  beforeEach(() => {
    findFirst.mockReset();
    findMany.mockReset();
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
    });

    expect(result?.id).toBe('legacy-form');
  });

  it('returns null when no form applies to the phase', async () => {
    findMany.mockResolvedValue([form({ 'x-phase': 'submission' })]);

    const result = await getCustomFormForProfile({
      profileId: 'p1',
      phaseId: 'voting',
      initialPhaseId: 'submission',
    });

    expect(result).toBeNull();
  });

  it('falls back to the first form when no phaseId is given', async () => {
    findFirst.mockResolvedValue(form({ 'x-phase': 'review' }, 'first-form'));

    const result = await getCustomFormForProfile({ profileId: 'p1' });

    expect(result?.id).toBe('first-form');
    expect(findMany).not.toHaveBeenCalled();
  });
});
