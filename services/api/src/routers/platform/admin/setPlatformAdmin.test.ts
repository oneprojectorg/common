import { db, eq } from '@op/db/client';
import { users } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { platformAdminRouter } from '.';
import { TestOrganizationDataManager } from '../../../test/helpers/TestOrganizationDataManager';
import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const SOME_AUTH_USER_ID = '00000000-0000-4000-a000-00000000dead';

describeAccessTierGating('platform.admin.setPlatformAdmin', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.platform.admin.setPlatformAdmin({
        authUserId: SOME_AUTH_USER_ID,
        isPlatformAdmin: true,
      }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.platform.admin.setPlatformAdmin({
          authUserId: SOME_AUTH_USER_ID,
          isPlatformAdmin: true,
        }),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'rejects user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expect(
        caller.platform.admin.setPlatformAdmin({
          authUserId: SOME_AUTH_USER_ID,
          isPlatformAdmin: true,
        }),
      ).rejects.toMatchObject({
        cause: { name: 'UnauthorizedError' },
      });
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.platform.admin.setPlatformAdmin({
          authUserId: SOME_AUTH_USER_ID,
          isPlatformAdmin: true,
        }),
      );
    },
  ),
});

// The "last platform admin cannot be revoked" guard is not exercised here: the
// test database always holds other platform admins (every network-domain test
// user is seeded with the flag), so the guard can never fire. It is covered by
// the service unit test —
// `packages/common/src/services/access/platformAdmin.test.ts`.
describe.concurrent('platform.admin.setPlatformAdmin', () => {
  const createCaller = createCallerFactory(platformAdminRouter);

  /** A platform-admin caller plus a target user who has no platform grant. */
  const setupActorAndTarget = async (
    task: { id: string },
    onTestFinished: (fn: () => void | Promise<void>) => void,
  ) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser: actor } = await testData.createOrganization({
      users: { admin: 1 },
    });
    const { adminUser: target } = await testData.createOrganization({
      users: { admin: 1 },
      isPlatformAdmin: false,
    });

    const { session } = await createIsolatedSession(actor.email);
    const caller = createCaller(await createTestContextWithSession(session));

    return { actor, target, caller };
  };

  const readFlag = async (authUserId: string) => {
    const [row] = await db
      .select({ isPlatformAdmin: users.isPlatformAdmin })
      .from(users)
      .where(eq(users.authUserId, authUserId));
    return row?.isPlatformAdmin;
  };

  it('grants platform admin to another user', async ({
    task,
    onTestFinished,
  }) => {
    const { target, caller } = await setupActorAndTarget(task, onTestFinished);

    expect(await readFlag(target.authUserId)).toBe(false);

    const result = await caller.setPlatformAdmin({
      authUserId: target.authUserId,
      isPlatformAdmin: true,
    });

    expect(result).toMatchObject({
      authUserId: target.authUserId,
      isPlatformAdmin: true,
    });
    expect(await readFlag(target.authUserId)).toBe(true);
  });

  it('revokes platform admin from another user', async ({
    task,
    onTestFinished,
  }) => {
    const { target, caller } = await setupActorAndTarget(task, onTestFinished);

    await caller.setPlatformAdmin({
      authUserId: target.authUserId,
      isPlatformAdmin: true,
    });

    const result = await caller.setPlatformAdmin({
      authUserId: target.authUserId,
      isPlatformAdmin: false,
    });

    expect(result).toMatchObject({
      authUserId: target.authUserId,
      isPlatformAdmin: false,
    });
    expect(await readFlag(target.authUserId)).toBe(false);
  });

  it('refuses to change the caller’s own flag', async ({
    task,
    onTestFinished,
  }) => {
    const { actor, caller } = await setupActorAndTarget(task, onTestFinished);

    await expect(
      caller.setPlatformAdmin({
        authUserId: actor.authUserId,
        isPlatformAdmin: false,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    expect(await readFlag(actor.authUserId)).toBe(true);
  });

  it('refuses a caller who is not a platform admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser: nonAdmin } = await testData.createOrganization({
      users: { admin: 1 },
      emailDomain: 'example.com',
    });
    const { adminUser: target } = await testData.createOrganization({
      users: { admin: 1 },
      isPlatformAdmin: false,
    });

    const { session } = await createIsolatedSession(nonAdmin.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.setPlatformAdmin({
        authUserId: target.authUserId,
        isPlatformAdmin: true,
      }),
    ).rejects.toThrow();

    expect(await readFlag(target.authUserId)).toBe(false);
  });

  it('404s for an auth user that does not exist', async ({
    task,
    onTestFinished,
  }) => {
    const { caller } = await setupActorAndTarget(task, onTestFinished);

    await expect(
      caller.setPlatformAdmin({
        authUserId: SOME_AUTH_USER_ID,
        isPlatformAdmin: true,
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });
});
