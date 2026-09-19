import { GLOBAL_USER_PUBLIC } from '@op/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const invalidateMultiple = vi.fn();

vi.mock('@op/cache', () => ({
  invalidateMultiple: (...args: unknown[]) => invalidateMultiple(...args),
}));

// The rows the profile currently holds, as the select would return them.
let memberRows: Array<{ profileId: string; authUserId: string }> = [];

// `@op/db/client` pulls in `server-only`, which Vitest can't load. Stub the
// one select this function performs.
vi.mock('@op/db/client', () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => Promise.resolve(memberRows) }),
    }),
  },
}));

vi.mock('../assert', () => ({ assertProfileAdmin: vi.fn() }));

import { invalidateProfileUserCacheForProfile } from './permissions';

const profileId = 'decision-profile';

// A member's key unions their own id with the public sentinel's; the
// sentinel's own key is the sentinel alone. See `resolveAccessUserIds`.
const memberKey = `member-1:${GLOBAL_USER_PUBLIC}`;

const invalidatedProfileUserKeys = () =>
  invalidateMultiple.mock.calls
    .filter(([call]) => call.type === 'profileUser')
    .flatMap(([call]) => call.paramsList);

describe('invalidateProfileUserCacheForProfile', () => {
  beforeEach(() => {
    invalidateMultiple.mockReset();
    memberRows = [];
  });

  it('drops the public sentinel key even once its row is gone', async () => {
    // What revoking public access leaves behind: the sentinel row is deleted,
    // so a select can no longer tell us its cached record needs clearing.
    memberRows = [{ profileId, authUserId: 'member-1' }];

    await invalidateProfileUserCacheForProfile(profileId);

    expect(invalidatedProfileUserKeys()).toEqual([
      [profileId, memberKey],
      [profileId, GLOBAL_USER_PUBLIC],
    ]);
  });

  it('does not queue the sentinel twice when its row is still present', async () => {
    memberRows = [
      { profileId, authUserId: 'member-1' },
      { profileId, authUserId: GLOBAL_USER_PUBLIC },
    ];

    await invalidateProfileUserCacheForProfile(profileId);

    expect(invalidatedProfileUserKeys()).toEqual([
      [profileId, memberKey],
      [profileId, GLOBAL_USER_PUBLIC],
    ]);
  });

  it('still clears the sentinel on a profile with no members at all', async () => {
    await invalidateProfileUserCacheForProfile(profileId);

    expect(invalidatedProfileUserKeys()).toEqual([
      [profileId, GLOBAL_USER_PUBLIC],
    ]);
  });
});
