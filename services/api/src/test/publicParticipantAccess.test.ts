import { assertProfileAccess, getProfileAccessRoles } from '@op/common';
import { GLOBAL_USER_PUBLIC } from '@op/core';
import { db } from '@op/db/client';
import { profileUserToAccessRoles, profileUsers } from '@op/db/schema';
import {
  PUBLIC_PARTICIPANT_ROLE_NAME,
  ROLES,
} from '@op/db/seedData/accessControl';
import { permission } from 'access-zones';
import { describe, expect, it } from 'vitest';

import { TestProfileUserDataManager } from './helpers/TestProfileUserDataManager';

/**
 * Grants the stable global Public Participant role on a profile, anchored on the
 * GLOBAL_USER_PUBLIC sentinel row (the join needs a `profileUserId`). Mirrors
 * the by-hand prod grant for the one public process. The grant cascades away
 * when the profile is deleted, so the manager's profile cleanup covers it — no
 * extra teardown needed.
 */
const grantPublicParticipant = async (profileId: string): Promise<void> => {
  const [publicProfileUser] = await db
    .insert(profileUsers)
    .values({
      authUserId: GLOBAL_USER_PUBLIC,
      profileId,
      name: 'Public',
    })
    .returning();

  if (!publicProfileUser) {
    throw new Error('Failed to create public profile user');
  }

  await db.insert(profileUserToAccessRoles).values({
    profileUserId: publicProfileUser.id,
    accessRoleId: ROLES.PUBLIC_PARTICIPANT.id,
  });
};

// The profile/decision access path resolves a caller's effective roles as their
// own grant unioned with the public grant — and detects the public grant by the
// Public Participant *role*, not by the caller's identity or the sentinel user
// id. These exercise that role-presence behaviour end-to-end against the DB.
describe.concurrent('public participant access', () => {
  it('lets a no-user caller read a public profile but not write it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile } = await testData.createProfile({ users: { admin: 1 } });
    await grantPublicParticipant(profile.id);

    const roles = await getProfileAccessRoles({
      user: undefined,
      profileId: profile.id,
    });
    expect(roles.map((role) => role.name)).toEqual([
      PUBLIC_PARTICIPANT_ROLE_NAME,
    ]);

    await expect(
      assertProfileAccess({
        profileId: profile.id,
        permissions: { decisions: permission.READ },
      }),
    ).resolves.toEqual({ roles });

    // Public access is read-only — a write permission is denied.
    await expect(
      assertProfileAccess({
        profileId: profile.id,
        permissions: { decisions: permission.UPDATE },
      }),
    ).rejects.toThrow();
  });

  it('denies a no-user caller on a profile without a public grant', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile } = await testData.createProfile({ users: { admin: 1 } });

    expect(
      await getProfileAccessRoles({ user: undefined, profileId: profile.id }),
    ).toEqual([]);

    await expect(
      assertProfileAccess({
        profileId: profile.id,
        permissions: { decisions: permission.READ },
      }),
    ).rejects.toThrow();
  });

  it('grants public read to an authenticated non-member via the role, not their identity', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile } = await testData.createProfile({ users: { admin: 1 } });
    await grantPublicParticipant(profile.id);

    // A real account with no grant on THIS profile (their own profile is
    // elsewhere). They still get the public grant — proving detection keys on
    // the role, not on the caller having a row of their own.
    const outsider = await testData.createStandaloneUser('example.com');

    const roles = await getProfileAccessRoles({
      user: { id: outsider.authUserId },
      profileId: profile.id,
    });
    expect(roles.map((role) => role.name)).toEqual([
      PUBLIC_PARTICIPANT_ROLE_NAME,
    ]);

    await expect(
      assertProfileAccess({
        user: { id: outsider.authUserId },
        profileId: profile.id,
        permissions: { decisions: permission.READ },
      }),
    ).resolves.toBeDefined();
  });

  it('unions a member’s own roles with the public grant', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, memberUsers } = await testData.createProfile({
      users: { admin: 1, member: 1 },
    });
    const member = memberUsers[0];
    if (!member) {
      throw new Error('Expected a seeded member user');
    }
    await grantPublicParticipant(profile.id);

    const roles = await getProfileAccessRoles({
      user: { id: member.authUserId },
      profileId: profile.id,
    });
    const roleNames = roles.map((role) => role.name);
    expect(roleNames).toContain('Member');
    expect(roleNames).toContain(PUBLIC_PARTICIPANT_ROLE_NAME);

    // The member keeps their own write capability — own ∪ public, not just the
    // read-only public grant.
    await expect(
      assertProfileAccess({
        user: { id: member.authUserId },
        profileId: profile.id,
        permissions: { decisions: permission.UPDATE },
      }),
    ).resolves.toBeDefined();
  });
});
