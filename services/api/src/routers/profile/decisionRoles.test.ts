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

describe.concurrent('profile.decisionRoles', () => {
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

    const result = await caller.getDecisionRole({
      roleId: customRole!.id,
      profileId: profile.id,
    });

    expect(result).toEqual({
      delete: false,
      update: false,
      read: false,
      create: false,
      admin: false,
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
    const updateResult = await caller.updateDecisionRoles({
      roleId: customRole!.id,
      decisionPermissions: {
        delete: false,
        update: false,
        read: false,
        create: false,
        admin: true,
        inviteMembers: false,
        review: true,
        submitProposals: true,
        vote: false,
      },
    });

    expect(updateResult.roleId).toBe(customRole!.id);
    expect(updateResult.decisionPermissions).toEqual({
      delete: false,
      update: false,
      read: false,
      create: false,
      admin: true,
      inviteMembers: false,
      review: true,
      submitProposals: true,
      vote: false,
    });

    // Verify the capabilities can be retrieved — read is true because updateDecisionRoles always forces READ
    const getResult = await caller.getDecisionRole({
      roleId: customRole!.id,
      profileId: profile.id,
    });

    expect(getResult).toEqual({
      delete: false,
      update: false,
      read: true,
      create: false,
      admin: true,
      inviteMembers: false,
      review: true,
      submitProposals: true,
      vote: false,
    });
  });

  it('should write the full bitfield when updating decision roles', async ({
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
        description: 'A custom role for decision roles testing',
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

    await caller.updateDecisionRoles({
      roleId: customRole!.id,
      decisionPermissions: {
        delete: false,
        update: false,
        read: false,
        create: false,
        admin: true,
        inviteMembers: true,
        review: true,
        submitProposals: false,
        vote: true,
      },
    });

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

    const acrud = fromBitField(permission!.permission);
    expect(acrud.admin).toBe(true);
    expect(acrud.read).toBe(true);

    expect(
      permission!.permission & decisionPermission.INVITE_MEMBERS,
    ).toBeTruthy();
    expect(permission!.permission & decisionPermission.REVIEW).toBeTruthy();
    expect(permission!.permission & decisionPermission.VOTE).toBeTruthy();
    expect(
      permission!.permission & decisionPermission.SUBMIT_PROPOSALS,
    ).toBeFalsy();
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
      caller.updateDecisionRoles({
        roleId: customRole!.id,
        decisionPermissions: {
          delete: false,
          update: false,
          read: false,
          create: false,
          admin: true,
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
    const globalRole = await db.query.accessRoles.findFirst({
      where: { profileId: { isNull: true } },
    });

    if (!globalRole) {
      throw new Error('No global role found in database');
    }

    await expect(
      caller.updateDecisionRoles({
        roleId: globalRole.id,
        decisionPermissions: {
          delete: false,
          update: false,
          read: false,
          create: false,
          admin: false,
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
    await caller.updateDecisionRoles({
      roleId: customRole!.id,
      decisionPermissions: {
        delete: false,
        update: false,
        read: false,
        create: false,
        admin: true,
        inviteMembers: true,
        review: true,
        submitProposals: true,
        vote: true,
      },
    });

    // Second update — disable all
    await caller.updateDecisionRoles({
      roleId: customRole!.id,
      decisionPermissions: {
        delete: false,
        update: false,
        read: false,
        create: false,
        admin: false,
        inviteMembers: false,
        review: false,
        submitProposals: false,
        vote: false,
      },
    });

    const result = await caller.getDecisionRole({
      roleId: customRole!.id,
      profileId: profile.id,
    });

    // read is true because updateDecisionRoles always forces READ
    expect(result).toEqual({
      delete: false,
      update: false,
      read: true,
      create: false,
      admin: false,
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

  it('should always set READ access by default when updating decision roles', async ({
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
        description: 'A custom role for READ default testing',
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

    // Set decision roles with no CRUD bits previously set
    await caller.updateDecisionRoles({
      roleId: customRole!.id,
      decisionPermissions: {
        delete: false,
        update: false,
        read: false,
        create: false,
        admin: false,
        inviteMembers: false,
        review: false,
        submitProposals: false,
        vote: false,
      },
    });

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

    const acrud = fromBitField(permission!.permission);
    expect(acrud.read).toBe(true);
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
      caller.updateDecisionRoles({
        roleId: customRole!.id,
        decisionPermissions: {
          delete: false,
          update: false,
          read: false,
          create: false,
          admin: true,
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
