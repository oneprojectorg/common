import {
  UnauthorizedError,
  assertProfileAccess,
  isProfilePublic,
  makeProfilePublic,
  revokeProfilePublicAccess,
} from '@op/common';
import { permission } from 'access-zones';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import profileRouter from '.';
import { TestProfileUserDataManager } from '../../test/helpers/TestProfileUserDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

/**
 * Opening a profile to the public.
 *
 * `TestProfileUserDataManager.createProfile` leaves `profiles.type` at its
 * default, so every profile here is an organization — the case the decision
 * helper in `@op/test` never covered, and the one this service adds.
 *
 * A stranger is a bare auth id holding no grant of its own. That is what makes
 * these assertions mean something: the only thing that can admit them is the
 * grant on the public sentinel, which `resolveAccessUserIds` unions in.
 */
describe.concurrent('public profile access', () => {
  const createCaller = createCallerFactory(profileRouter);

  it('admits a stranger to an organization it opened', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    await makeProfilePublic({
      profileId: profile.id,
      user: { id: adminUser.authUserId },
    });

    const roles = await assertProfileAccess({
      user: { id: randomUUID() },
      profileId: profile.id,
      permissions: { profile: permission.READ },
    });

    expect(roles.length).toBeGreaterThan(0);
  });

  it('does not let the public write to it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    await makeProfilePublic({
      profileId: profile.id,
      user: { id: adminUser.authUserId },
    });

    // The grant is permission bits on one profile, not a bypass. Reading is the
    // whole of it — if this ever passes, every public profile is world-writable.
    await expect(
      assertProfileAccess({
        user: { id: randomUUID() },
        profileId: profile.id,
        permissions: { profile: permission.UPDATE },
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('closes again when the grant is revoked', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });
    const admin = { id: adminUser.authUserId };

    await makeProfilePublic({ profileId: profile.id, user: admin });
    expect(await isProfilePublic(profile.id)).toBe(true);

    await revokeProfilePublicAccess({ profileId: profile.id, user: admin });
    expect(await isProfilePublic(profile.id)).toBe(false);

    // A stranger who never asked before, because the answer for one who did is
    // cached under their own id and this service cannot reach that key.
    await expect(
      assertProfileAccess({
        user: { id: randomUUID() },
        profileId: profile.id,
        permissions: { profile: permission.READ },
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('is idempotent', async ({ task, onTestFinished }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });
    const admin = { id: adminUser.authUserId };

    await makeProfilePublic({ profileId: profile.id, user: admin });
    await makeProfilePublic({ profileId: profile.id, user: admin });

    const roles = await assertProfileAccess({
      user: { id: randomUUID() },
      profileId: profile.id,
      permissions: { profile: permission.READ },
    });

    expect(roles.length).toBeGreaterThan(0);
  });

  it('refuses a caller who does not administer the profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, memberUsers } = await testData.createProfile({
      users: { admin: 1, member: 1 },
    });

    // A member of the profile, not an admin: holding a grant is not the same
    // as being allowed to hand one to everyone.
    const { session } = await createIsolatedSession(memberUsers[0]!.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.setProfilePublic({ profileId: profile.id, isPublic: true }),
    ).rejects.toThrow();

    expect(await isProfilePublic(profile.id)).toBe(false);
  });
});
