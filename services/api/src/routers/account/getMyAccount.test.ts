import { db } from '@op/db/client';
import { accessRoles, profileUserToAccessRoles } from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { TestProfileUserDataManager } from '../../test/helpers/TestProfileUserDataManager';

describe.concurrent('user signup', () => {
  it('creates an owner profileUser with Admin role for the individual profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { authUserId, userProfileId } = await testData.createStandaloneUser();

    // Verify a profileUser was created for the individual profile
    const profileUser = await db.query.profileUsers.findFirst({
      where: {
        authUserId,
        profileId: userProfileId,
      },
    });

    if (!profileUser) {
      throw new Error('profileUser not found');
    }

    expect(profileUser.isOwner).toBe(true);

    // Verify the global Admin role is assigned to that profileUser
    const [roleAssignment] = await db
      .select({ name: accessRoles.name, profileId: accessRoles.profileId })
      .from(profileUserToAccessRoles)
      .innerJoin(
        accessRoles,
        eq(profileUserToAccessRoles.accessRoleId, accessRoles.id),
      )
      .where(eq(profileUserToAccessRoles.profileUserId, profileUser.id));

    expect(roleAssignment?.name).toBe('Admin');
    expect(roleAssignment?.profileId).toBeNull();
  });
});
