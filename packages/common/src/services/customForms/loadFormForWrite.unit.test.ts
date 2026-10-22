import type { User } from '@op/supabase/lib';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../utils';

// `@op/db/client` pulls in `server-only`, which Vitest can't load. The builder
// below stands in for the select → leftJoin → where → limit chain.
const limit = vi.fn();

const builder = {
  from: () => builder,
  leftJoin: () => builder,
  where: () => builder,
  limit: () => limit(),
};

vi.mock('@op/db/client', () => ({
  db: { select: () => builder },
  and: (...args: unknown[]) => args,
  eq: (...args: unknown[]) => args,
  isNull: (...args: unknown[]) => args,
}));

vi.mock('@op/db/schema', () => ({
  customForms: { id: 'id', profileId: 'profile_id', deletedAt: 'deleted_at' },
  processInstances: { profileId: 'profile_id' },
}));

const assertCustomFormAdminForInstance = vi.fn();

vi.mock('./customFormAuth', () => ({
  assertCustomFormAdminForInstance: (...args: unknown[]) =>
    assertCustomFormAdminForInstance(...args),
}));

const { loadFormForWrite } = await import('./loadFormForWrite');

const user = { id: 'auth-user', email: 'admin@oneproject.org' } as User;

const context = {
  profileId: 'decision-profile',
  initialPhaseId: 'submission',
  phaseIds: ['submission', 'voting'],
};

describe('loadFormForWrite', () => {
  beforeEach(() => {
    limit.mockReset();
    assertCustomFormAdminForInstance.mockReset();
    assertCustomFormAdminForInstance.mockResolvedValue(context);
  });

  it('resolves the form and its process in one query', async () => {
    limit.mockResolvedValue([
      {
        formId: 'form-1',
        formProfileId: 'decision-profile',
        instanceProfileId: 'decision-profile',
        ownerProfileId: 'org-profile',
        instanceData: { phases: [{ phaseId: 'submission' }] },
      },
    ]);

    const result = await loadFormForWrite({ id: 'form-1', user });

    expect(limit).toHaveBeenCalledOnce();
    expect(result).toEqual({ formId: 'form-1', process: context });
  });

  it('passes the joined instance to the authorization rule', async () => {
    limit.mockResolvedValue([
      {
        formId: 'form-1',
        formProfileId: 'decision-profile',
        instanceProfileId: 'decision-profile',
        ownerProfileId: 'org-profile',
        instanceData: { phases: [] },
      },
    ]);

    await loadFormForWrite({ id: 'form-1', user });

    expect(assertCustomFormAdminForInstance).toHaveBeenCalledWith({
      user,
      instance: {
        profileId: 'decision-profile',
        ownerProfileId: 'org-profile',
        instanceData: { phases: [] },
      },
    });
  });

  it('404s a form that does not exist or is already deleted', async () => {
    limit.mockResolvedValue([]);

    await expect(loadFormForWrite({ id: 'gone', user })).rejects.toThrow(
      NotFoundError,
    );
    expect(assertCustomFormAdminForInstance).not.toHaveBeenCalled();
  });

  it('404s when the form hangs off a profile that is not a decision process', async () => {
    // The left join keeps the form row and leaves the instance columns null.
    limit.mockResolvedValue([
      {
        formId: 'form-1',
        formProfileId: 'orphan-profile',
        instanceProfileId: null,
        ownerProfileId: null,
        instanceData: null,
      },
    ]);

    await expect(loadFormForWrite({ id: 'form-1', user })).rejects.toThrow(
      NotFoundError,
    );
    expect(assertCustomFormAdminForInstance).not.toHaveBeenCalled();
  });
});
