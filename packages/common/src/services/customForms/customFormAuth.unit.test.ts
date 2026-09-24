import type { User } from '@op/supabase/lib';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError, UnauthorizedError } from '../../utils';

// `@op/db/client` pulls in `server-only`, which Vitest can't load. Stub it with
// a fake `db` exposing just the lookup this module performs.
const findFirst = vi.fn();

vi.mock('@op/db/client', () => ({
  db: {
    query: {
      processInstances: {
        findFirst: (...args: unknown[]) => findFirst(...args),
      },
    },
  },
}));

const assertInstanceProfileAccess = vi.fn();
const isUserEmailPlatformAdmin = vi.fn();

vi.mock('../access', () => ({
  assertInstanceProfileAccess: (...args: unknown[]) =>
    assertInstanceProfileAccess(...args),
  isUserEmailPlatformAdmin: (...args: unknown[]) =>
    isUserEmailPlatformAdmin(...args),
}));

import { assertCustomFormAdmin } from './customFormAuth';

const user = (email?: string) => ({ id: 'auth-user', email }) as User;

const instance = (phaseIds: string[]) => ({
  profileId: 'decision-profile',
  ownerProfileId: 'org-profile',
  instanceData: { phases: phaseIds.map((phaseId) => ({ phaseId })) },
});

describe('assertCustomFormAdmin', () => {
  beforeEach(() => {
    findFirst.mockReset();
    assertInstanceProfileAccess.mockReset();
    isUserEmailPlatformAdmin.mockReset();
    isUserEmailPlatformAdmin.mockReturnValue(false);
  });

  it('admits a platform admin without consulting the process grant', async () => {
    findFirst.mockResolvedValue(instance(['submission', 'voting']));
    isUserEmailPlatformAdmin.mockReturnValue(true);

    const context = await assertCustomFormAdmin({
      user: user('admin@oneproject.org'),
      profileId: 'decision-profile',
    });

    expect(assertInstanceProfileAccess).not.toHaveBeenCalled();
    expect(context.phaseIds).toEqual(['submission', 'voting']);
  });

  it('admits a decision-process admin', async () => {
    findFirst.mockResolvedValue(instance(['submission']));
    assertInstanceProfileAccess.mockResolvedValue([]);

    const context = await assertCustomFormAdmin({
      user: user('member@example.org'),
      profileId: 'decision-profile',
    });

    expect(assertInstanceProfileAccess).toHaveBeenCalledOnce();
    expect(context.profileId).toBe('decision-profile');
  });

  it('refuses a caller who is neither', async () => {
    findFirst.mockResolvedValue(instance(['submission']));
    assertInstanceProfileAccess.mockRejectedValue(new UnauthorizedError());

    await expect(
      assertCustomFormAdmin({
        user: user('stranger@example.org'),
        profileId: 'decision-profile',
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('treats a user with no email as not a platform admin', async () => {
    findFirst.mockResolvedValue(instance(['submission']));
    assertInstanceProfileAccess.mockResolvedValue([]);

    await assertCustomFormAdmin({
      user: user(undefined),
      profileId: 'decision-profile',
    });

    expect(isUserEmailPlatformAdmin).not.toHaveBeenCalled();
    expect(assertInstanceProfileAccess).toHaveBeenCalledOnce();
  });

  it('404s a profile that is not a decision process', async () => {
    findFirst.mockResolvedValue(undefined);
    isUserEmailPlatformAdmin.mockReturnValue(true);

    await expect(
      assertCustomFormAdmin({
        user: user('admin@oneproject.org'),
        profileId: 'some-profile',
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('resolves the initial phase legacy forms belong to', async () => {
    findFirst.mockResolvedValue(instance(['submission', 'review', 'voting']));
    isUserEmailPlatformAdmin.mockReturnValue(true);

    const context = await assertCustomFormAdmin({
      user: user('admin@oneproject.org'),
      profileId: 'decision-profile',
    });

    expect(context.initialPhaseId).toBe('submission');
  });

  it('reports no phases when instanceData has none to parse', async () => {
    findFirst.mockResolvedValue({
      profileId: 'decision-profile',
      ownerProfileId: 'org-profile',
      instanceData: { config: {} },
    });
    isUserEmailPlatformAdmin.mockReturnValue(true);

    const context = await assertCustomFormAdmin({
      user: user('admin@oneproject.org'),
      profileId: 'decision-profile',
    });

    expect(context.phaseIds).toEqual([]);
    expect(context.initialPhaseId).toBeNull();
  });

  it('refuses a platform admin when the instance has no profile of its own', async () => {
    findFirst.mockResolvedValue({
      profileId: null,
      ownerProfileId: 'org-profile',
      instanceData: { phases: [{ phaseId: 'submission' }] },
    });
    isUserEmailPlatformAdmin.mockReturnValue(true);

    await expect(
      assertCustomFormAdmin({
        user: user('admin@oneproject.org'),
        profileId: 'decision-profile',
      }),
    ).rejects.toThrow(UnauthorizedError);
  });
});
