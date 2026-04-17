import { db } from '@op/db/client';
import { users } from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { TestOrganizationDataManager } from '../../test/helpers/TestOrganizationDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';
import accountRouter from './index';

describe.concurrent('account.switchOrganization', () => {
  const createCaller = createCallerFactory(accountRouter);

  it('should successfully switch organization when caller is a member', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { organization, organizationProfile, adminUser } =
      await testData.createOrganization({
        users: { admin: 1 },
        organizationName: 'Member Switch Org',
      });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.switchOrganization({
      organizationId: organization.id,
    });

    expect(result.currentProfileId).toBe(organizationProfile.id);

    const [userRecord] = await db
      .select({
        currentProfileId: users.currentProfileId,
        lastOrgId: users.lastOrgId,
      })
      .from(users)
      .where(eq(users.authUserId, adminUser.authUserId));

    expect(userRecord?.currentProfileId).toBe(organizationProfile.id);
    expect(userRecord?.lastOrgId).toBe(organization.id);
  });

  it('should throw UNAUTHORIZED when caller is not a member of target org', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    // Target org the attacker is NOT a member of
    const { organization: targetOrg, organizationProfile: targetProfile } =
      await testData.createOrganization({
        users: { admin: 1 },
        organizationName: 'Target Org',
      });

    // Attacker has their own org; they are not a member of targetOrg
    const { adminUser: attacker } = await testData.createOrganization({
      users: { admin: 1 },
      organizationName: 'Attacker Org',
    });

    // Snapshot the attacker's currentProfileId before the exploit attempt
    const [before] = await db
      .select({ currentProfileId: users.currentProfileId })
      .from(users)
      .where(eq(users.authUserId, attacker.authUserId));

    const { session } = await createIsolatedSession(attacker.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.switchOrganization({
        organizationId: targetOrg.id,
      }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });

    // Verify the attacker's currentProfileId was NOT changed to the victim org's profile
    const [after] = await db
      .select({
        currentProfileId: users.currentProfileId,
        lastOrgId: users.lastOrgId,
      })
      .from(users)
      .where(eq(users.authUserId, attacker.authUserId));

    expect(after?.currentProfileId).toBe(before?.currentProfileId);
    expect(after?.currentProfileId).not.toBe(targetProfile.id);
    expect(after?.lastOrgId).not.toBe(targetOrg.id);
  });

  it('should throw NOT_FOUND when organization does not exist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1 },
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.switchOrganization({
        organizationId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
