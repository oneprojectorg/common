import { db } from '@op/db/client';
import {
  accessRoles,
  organizationUserToAccessRoles,
  organizationUsers,
  organizations,
  profiles,
  users,
} from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { organizationRouter } from '.';
import { TestOrganizationDataManager } from '../../test/helpers/TestOrganizationDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
  createTestUser,
  supabaseTestAdminClient,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

describe.concurrent('organization.join', () => {
  const createCaller = createCallerFactory(organizationRouter);

  /**
   * Helper to clean up a joiner user created with createTestUser.
   * Deletes the individual profile (cascades to profile_users) then the auth user
   * (cascades to the users row). The organizationUser row is handled by the
   * profile cascade because it foreign-keys back to the user.
   */
  const cleanupJoiner = async (authUserId: string) => {
    const [userRecord] = await db
      .select({ profileId: users.profileId })
      .from(users)
      .where(eq(users.authUserId, authUserId));

    if (userRecord?.profileId) {
      await db
        .delete(profiles)
        .where(eq(profiles.id, userRecord.profileId));
    }

    await supabaseTestAdminClient?.auth.admin.deleteUser(authUserId);
  };

  it('joins an organization via email domain match and assigns the Member role', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    // Create an org and set its domain to oneproject.org so the joiner can match.
    // oneproject.org emails also bypass the allowList check in withAuthenticated.
    const { organization } = await testData.createOrganization({
      users: { admin: 1 },
      organizationName: 'Join Test Org',
    });

    await db
      .update(organizations)
      .set({ domain: 'oneproject.org' })
      .where(eq(organizations.id, organization.id));

    const joinerEmail = `${task.id.slice(0, 8)}-joiner@oneproject.org`;
    const { user: authUser } = await createTestUser(joinerEmail);

    if (!authUser) {
      throw new Error('Failed to create auth user');
    }

    onTestFinished(() => cleanupJoiner(authUser.id));

    const { session } = await createIsolatedSession(joinerEmail);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.join({ organizationId: organization.id });

    expect(result.organizationUserId).toBeTruthy();

    // Verify the organizationUser record exists
    const [orgUser] = await db
      .select()
      .from(organizationUsers)
      .where(eq(organizationUsers.id, result.organizationUserId));

    expect(orgUser).toBeDefined();
    expect(orgUser?.organizationId).toBe(organization.id);
    expect(orgUser?.authUserId).toBe(authUser.id);

    // Verify the Member role was assigned
    const [roleAssignment] = await db
      .select({ roleName: accessRoles.name })
      .from(organizationUserToAccessRoles)
      .innerJoin(
        accessRoles,
        eq(organizationUserToAccessRoles.accessRoleId, accessRoles.id),
      )
      .where(
        eq(
          organizationUserToAccessRoles.organizationUserId,
          result.organizationUserId,
        ),
      );

    expect(roleAssignment?.roleName).toBe('Member');
  });

  it('returns existing membership without error when called again', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { organization, adminUser } = await testData.createOrganization({
      users: { admin: 1 },
    });

    await db
      .update(organizations)
      .set({ domain: 'oneproject.org' })
      .where(eq(organizations.id, organization.id));

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // adminUser is already a member — both calls should return the same record
    const first = await caller.join({ organizationId: organization.id });
    const second = await caller.join({ organizationId: organization.id });

    expect(first.organizationUserId).toBe(second.organizationUserId);
  });

  it('rejects a user whose email domain does not match the organization domain', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { organization } = await testData.createOrganization({
      users: { admin: 1 },
      organizationName: 'Domain Restricted Org',
    });

    // Org has a domain the joiner does not belong to
    const restrictedDomain = `restricted-${task.id.slice(0, 8)}.com`;
    await db
      .update(organizations)
      .set({ domain: restrictedDomain })
      .where(eq(organizations.id, organization.id));

    // Joiner uses oneproject.org (passes withAuthenticated) but domain won't match
    const outsiderEmail = `${task.id.slice(0, 8)}-outsider@oneproject.org`;
    const { user: authUser } = await createTestUser(outsiderEmail);

    if (!authUser) {
      throw new Error('Failed to create auth user');
    }

    onTestFinished(() => cleanupJoiner(authUser.id));

    const { session } = await createIsolatedSession(outsiderEmail);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(() =>
      caller.join({ organizationId: organization.id }),
    ).rejects.toThrow();
  });
});
