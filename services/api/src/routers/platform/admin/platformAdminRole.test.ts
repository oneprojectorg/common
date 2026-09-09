import { grantPlatformAdmin, revokePlatformAdmin } from '@op/common';
import { db } from '@op/db/client';
import {
  EntityType,
  profileUserToAccessRoles,
  profileUsers,
  profiles,
  users,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { platformAdminRouter } from '.';
import {
  createIsolatedSession,
  createTestContextWithSession,
  createTestUser,
  supabaseTestAdminClient,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(platformAdminRouter);

/**
 * A user plus the ids the signup trigger created for them, and a factory for a
 * second profile they are a member of.
 */
const createTestSubject = async (
  onTestFinished: (fn: () => void | Promise<void>) => void,
) => {
  const createdAuthUserIds: string[] = [];
  const createdProfileIds: string[] = [];

  onTestFinished(async () => {
    if (createdProfileIds.length > 0) {
      await db.delete(profiles).where(inArray(profiles.id, createdProfileIds));
    }
    if (createdAuthUserIds.length > 0) {
      await db
        .delete(users)
        .where(inArray(users.authUserId, createdAuthUserIds));
      await Promise.allSettled(
        createdAuthUserIds.map((id) =>
          supabaseTestAdminClient.auth.admin.deleteUser(id),
        ),
      );
    }
  });

  const email = `platform-role-${randomUUID().slice(0, 12)}@oneproject.org`;
  const { user } = await createTestUser(email);

  if (!user) {
    throw new Error(`Failed to create test user: ${email}`);
  }

  createdAuthUserIds.push(user.id);

  const userRecord = await db.query.users.findFirst({
    where: { authUserId: user.id },
  });

  if (!userRecord?.profileId) {
    throw new Error('Signup trigger did not create an individual profile');
  }

  createdProfileIds.push(userRecord.profileId);

  const caller = async () => {
    const { session } = await createIsolatedSession(email);
    return createCaller(await createTestContextWithSession(session));
  };

  const grantOnOtherProfile = async () => {
    const [otherProfile] = await db
      .insert(profiles)
      .values({
        type: EntityType.ORG,
        name: 'Other profile',
        slug: `other-profile-${randomUUID().slice(0, 12)}`,
      })
      .returning({ id: profiles.id });

    if (!otherProfile) {
      throw new Error('Failed to create the other profile');
    }

    createdProfileIds.push(otherProfile.id);

    const [membership] = await db
      .insert(profileUsers)
      .values({ authUserId: user.id, profileId: otherProfile.id, email })
      .returning({ id: profileUsers.id });

    if (!membership) {
      throw new Error('Failed to create the other membership');
    }

    await db.insert(profileUserToAccessRoles).values({
      profileUserId: membership.id,
      accessRoleId: ROLES.PLATFORM_ADMIN.id,
    });

    return otherProfile.id;
  };

  return { authUserId: user.id, email, caller, grantOnOtherProfile };
};

// The gate is what the assertions read: a caller past it gets a not-found for
// the random instance id, a caller stopped by it gets UnauthorizedError.
const gatingInput = { instanceId: randomUUID() };

describe.concurrent('platform admin as a user-level access role', () => {
  it('admits a caller granted the role on their own profile', async ({
    onTestFinished,
  }) => {
    const subject = await createTestSubject(onTestFinished);
    await grantPlatformAdmin({ authUserId: subject.authUserId });

    const caller = await subject.caller();

    await expect(caller.getDecisionInstance(gatingInput)).rejects.toMatchObject(
      { cause: { name: 'NotFoundError' } },
    );
  });

  it('rejects a caller holding the role on another profile only', async ({
    onTestFinished,
  }) => {
    const subject = await createTestSubject(onTestFinished);
    await subject.grantOnOtherProfile();

    const caller = await subject.caller();

    await expect(caller.getDecisionInstance(gatingInput)).rejects.toMatchObject(
      { cause: { name: 'UnauthorizedError' } },
    );
  });

  it('rejects a caller with only the trigger-granted Admin role', async ({
    onTestFinished,
  }) => {
    const subject = await createTestSubject(onTestFinished);

    const caller = await subject.caller();

    await expect(caller.getDecisionInstance(gatingInput)).rejects.toMatchObject(
      { cause: { name: 'UnauthorizedError' } },
    );
  });

  it('rejects the caller again after a revoke', async ({ onTestFinished }) => {
    const subject = await createTestSubject(onTestFinished);
    await grantPlatformAdmin({ authUserId: subject.authUserId });

    const grantedCaller = await subject.caller();
    await expect(
      grantedCaller.getDecisionInstance(gatingInput),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });

    await revokePlatformAdmin({ authUserId: subject.authUserId });

    const revokedCaller = await subject.caller();
    await expect(
      revokedCaller.getDecisionInstance(gatingInput),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('is idempotent for both grant and revoke', async ({ onTestFinished }) => {
    const subject = await createTestSubject(onTestFinished);

    await revokePlatformAdmin({ authUserId: subject.authUserId });
    await grantPlatformAdmin({ authUserId: subject.authUserId });
    await grantPlatformAdmin({ authUserId: subject.authUserId });

    const rows = await db.query.profileUsers.findMany({
      where: { authUserId: subject.authUserId },
      with: { roles: true },
    });

    expect(
      rows.flatMap((row) =>
        row.roles.filter(
          (role) => role.accessRoleId === ROLES.PLATFORM_ADMIN.id,
        ),
      ),
    ).toHaveLength(1);
  });
});
