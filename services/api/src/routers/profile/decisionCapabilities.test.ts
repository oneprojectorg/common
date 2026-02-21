import { decisionPermission } from '@op/common';
import { db } from '@op/db/client';
import { accessRolePermissionsOnAccessZones, accessRoles } from '@op/db/schema';
import { fromBitField } from 'access-zones';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import profileRouter from '.';
import { TestProfileUserDataManager } from '../../test/helpers/TestProfileUserDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

describe.concurrent('profile.decisionCapabilities', () => {
  const createCaller = createCallerFactory(profileRouter);

  it('should return all-false capabilities for a role with no decision bits', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Create a custom role for this profile
    const [customRole] = await db
      .insert(accessRoles)
      .values({
        name: `Decision Cap Role ${task.id}`,
        description: 'A custom role for decision capabilities testing',
        profileId: profile.id,
      })
      .returning();

    onTestFinished(async () => {
      if (customRole) {
        await db.delete(accessRoles).where(eq(accessRoles.id, customRole.id));
      }
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.getDecisionCapabilities({
      roleId: customRole!.id,
      profileId: profile.id,
    });

    expect(result).toEqual({
      inviteMembers: false,
      review: false,
      submitProposals: false,
      vote: false,
    });
  });

  it('should update and retrieve decision capabilities for a role', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    const [customRole] = await db
      .insert(accessRoles)
      .values({
        name: `Decision Cap Role ${task.id}`,
        description: 'A custom role for decision capabilities testing',
        profileId: profile.id,
      })
      .returning();

    onTestFinished(async () => {
      if (customRole) {
        await db.delete(accessRoles).where(eq(accessRoles.id, customRole.id));
      }
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Set some decision capabilities
    const updateResult = await caller.updateDecisionCapabilities({
      roleId: customRole!.id,
      decisionPermissions: {
        inviteMembers: false,
        review: true,
        submitProposals: true,
        vote: false,
      },
    });

    expect(updateResult.roleId).toBe(customRole!.id);
    expect(updateResult.decisionPermissions).toEqual({
      inviteMembers: false,
      review: true,
      submitProposals: true,
      vote: false,
    });

    // Verify the capabilities can be retrieved
    const getResult = await caller.getDecisionCapabilities({
      roleId: customRole!.id,
      profileId: profile.id,
    });

    expect(getResult).toEqual({
      inviteMembers: false,
      review: true,
      submitProposals: true,
      vote: false,
    });
  });

  it('should preserve ACRUD bits when updating decision capabilities', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    const [customRole] = await db
      .insert(accessRoles)
      .values({
        name: `Decision Cap Role ${task.id}`,
        description: 'A custom role for decision capabilities testing',
        profileId: profile.id,
      })
      .returning();

    onTestFinished(async () => {
      if (customRole) {
        await db.delete(accessRoles).where(eq(accessRoles.id, customRole.id));
      }
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // First, set ACRUD permissions via updateRolePermission
    await caller.updateRolePermission({
      roleId: customRole!.id,
      permissions: {
        admin: false,
        create: true,
        read: true,
        update: false,
        delete: false,
      },
    });

    // Now set decision capabilities
    await caller.updateDecisionCapabilities({
      roleId: customRole!.id,
      decisionPermissions: {
        inviteMembers: true,
        review: true,
        submitProposals: false,
        vote: true,
      },
    });

    // Verify that ACRUD bits are still present in the raw permission
    const decisionsZone = await db._query.accessZones.findFirst({
      where: (table, { eq }) => eq(table.name, 'decisions'),
    });

    const permission =
      await db._query.accessRolePermissionsOnAccessZones.findFirst({
        where: (table, { eq, and }) =>
          and(
            eq(table.accessRoleId, customRole!.id),
            eq(table.accessZoneId, decisionsZone!.id),
          ),
      });

    expect(permission).toBeDefined();

    // ACRUD bits (0–4) should still show create=true, read=true
    const acrud = fromBitField(permission!.permission);
    expect(acrud.create).toBe(true);
    expect(acrud.read).toBe(true);
    expect(acrud.update).toBe(false);
    expect(acrud.delete).toBe(false);

    // Decision bits should also be correct
    const higherBits = permission!.permission & ~31;
    expect(higherBits & decisionPermission.INVITE_MEMBERS).toBeTruthy();
    expect(higherBits & decisionPermission.REVIEW).toBeTruthy();
    expect(higherBits & decisionPermission.VOTE).toBeTruthy();
    expect(higherBits & decisionPermission.SUBMIT_PROPOSALS).toBeFalsy();
  });

  it('should not allow non-admin to update decision capabilities', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, memberUsers } = await testData.createProfile({
      users: { admin: 1, member: 1 },
    });

    const [customRole] = await db
      .insert(accessRoles)
      .values({
        name: `Decision Cap Role ${task.id}`,
        description: 'A custom role for testing',
        profileId: profile.id,
      })
      .returning();

    onTestFinished(async () => {
      if (customRole) {
        await db.delete(accessRoles).where(eq(accessRoles.id, customRole.id));
      }
    });

    const { session } = await createIsolatedSession(memberUsers[0]!.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.updateDecisionCapabilities({
        roleId: customRole!.id,
        decisionPermissions: {
          inviteMembers: true,
          review: true,
          submitProposals: true,
          vote: true,
        },
      }),
    ).rejects.toSatisfy(
      (error: Error & { cause?: Error }) =>
        error.cause?.name === 'AccessControlException',
    );
  });

  it('should not allow updating decision capabilities for global roles', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Use a well-known global role ID — global roles have no profileId
    const globalRole = await db._query.accessRoles.findFirst({
      where: (table, { isNull }) => isNull(table.profileId),
    });

    if (!globalRole) {
      throw new Error('No global role found in database');
    }

    await expect(
      caller.updateDecisionCapabilities({
        roleId: globalRole.id,
        decisionPermissions: {
          inviteMembers: false,
          review: false,
          submitProposals: false,
          vote: false,
        },
      }),
    ).rejects.toMatchObject({
      cause: { name: 'NotFoundError' },
    });
  });

  it('should overwrite previous decision capabilities on re-update', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    const [customRole] = await db
      .insert(accessRoles)
      .values({
        name: `Decision Cap Role ${task.id}`,
        description: 'A custom role for testing',
        profileId: profile.id,
      })
      .returning();

    onTestFinished(async () => {
      if (customRole) {
        await db.delete(accessRoles).where(eq(accessRoles.id, customRole.id));
      }
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // First update — enable all
    await caller.updateDecisionCapabilities({
      roleId: customRole!.id,
      decisionPermissions: {
        inviteMembers: true,
        review: true,
        submitProposals: true,
        vote: true,
      },
    });

    // Second update — disable all
    await caller.updateDecisionCapabilities({
      roleId: customRole!.id,
      decisionPermissions: {
        inviteMembers: false,
        review: false,
        submitProposals: false,
        vote: false,
      },
    });

    const result = await caller.getDecisionCapabilities({
      roleId: customRole!.id,
      profileId: profile.id,
    });

    expect(result).toEqual({
      inviteMembers: false,
      review: false,
      submitProposals: false,
      vote: false,
    });

    // Verify only one permission entry exists (not duplicated)
    const decisionsZone = await db._query.accessZones.findFirst({
      where: (table, { eq }) => eq(table.name, 'decisions'),
    });

    const permissions = await db
      .select()
      .from(accessRolePermissionsOnAccessZones)
      .where(
        and(
          eq(accessRolePermissionsOnAccessZones.accessRoleId, customRole!.id),
          eq(
            accessRolePermissionsOnAccessZones.accessZoneId,
            decisionsZone!.id,
          ),
        ),
      );

    expect(permissions.length).toBe(1);
  });

  it('should not allow admin from different profile to update decision capabilities', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);

    // Create Profile A with a custom role
    const { profile: profileA } = await testData.createProfile({
      users: { admin: 1 },
    });

    const [customRole] = await db
      .insert(accessRoles)
      .values({
        name: `Decision Cap Role ${task.id}`,
        description: 'A custom role for Profile A',
        profileId: profileA.id,
      })
      .returning();

    onTestFinished(async () => {
      if (customRole) {
        await db.delete(accessRoles).where(eq(accessRoles.id, customRole.id));
      }
    });

    // Create Profile B with its own admin
    const { adminUser: adminB } = await testData.createProfile({
      users: { admin: 1 },
    });

    const { session } = await createIsolatedSession(adminB.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.updateDecisionCapabilities({
        roleId: customRole!.id,
        decisionPermissions: {
          inviteMembers: true,
          review: true,
          submitProposals: true,
          vote: true,
        },
      }),
    ).rejects.toSatisfy(
      (error: Error & { cause?: Error }) =>
        error.cause?.name === 'UnauthorizedError',
    );
  });
});
