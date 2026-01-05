import { db } from '@op/db/client';
import { profiles } from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { organizationRouter } from '.';
import { TestOrganizationDataManager } from '../../test/helpers/TestOrganizationDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

describe.concurrent('organization.deleteOrganization', () => {
  const createCaller = createCallerFactory(organizationRouter);

  it('should successfully delete an organization as admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { organization, organizationProfile, adminUser } =
      await testData.createOrganization({
        users: { admin: 1 },
        organizationName: 'Delete Test Org',
      });

    // Create isolated session for admin user
    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Delete the organization
    const result = await caller.deleteOrganization({
      organizationProfileId: organizationProfile.id,
    });

    // Verify the response contains expected profile fields
    expect(result).toBeDefined();
    expect(result.id).toBe(organizationProfile.id);
    expect(result.name).toBe(organizationProfile.name);
    expect(result.slug).toBe(organizationProfile.slug);

    // Verify the organization was actually deleted from the database
    const deletedProfile = await db.query.profiles.findFirst({
      where: eq(profiles.id, organizationProfile.id),
    });
    expect(deletedProfile).toBeUndefined();
  });

  it('should throw error when non-member tries to delete organization', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    // Create first organization with its own admin
    const { organizationProfile } = await testData.createOrganization({
      users: { admin: 1 },
      organizationName: 'Target Org',
    });

    // Create second organization with a different admin
    const { adminUser: otherAdmin } = await testData.createOrganization({
      users: { admin: 1 },
      organizationName: 'Other Org',
    });

    // Try to delete first org using the second org's admin
    const { session } = await createIsolatedSession(otherAdmin.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.deleteOrganization({
        organizationProfileId: organizationProfile.id,
      }),
    ).rejects.toThrow();
  });

  it('should throw error when member without admin role tries to delete organization', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { organizationProfile, memberUsers } =
      await testData.createOrganization({
        users: { admin: 1, member: 1 },
        organizationName: 'Member Delete Test Org',
      });

    const memberUser = memberUsers[0];
    if (!memberUser) {
      throw new Error('Member user should exist');
    }

    // Try to delete org as member (not admin)
    const { session } = await createIsolatedSession(memberUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.deleteOrganization({
        organizationProfileId: organizationProfile.id,
      }),
    ).rejects.toThrow();
  });

  it('should throw error for non-existent organization', async ({
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
      caller.deleteOrganization({
        organizationProfileId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toThrow();
  });
});
