import { db } from '@op/db/client';
import { accessRolePermissionsOnAccessZones, accessRoles } from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
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

describe.concurrent('profile.updateRolePermission', () => {
  const createCaller = createCallerFactory(profileRouter);

  it('should allow admin to update permissions for a profile-specific role', async ({
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
        name: `Custom Role ${task.id}`,
        description: 'A custom role for testing',
        profileId: profile.id,
      })
      .returning();

    // Track for cleanup
    onTestFinished(async () => {
      if (customRole) {
        await db.delete(accessRoles).where(eq(accessRoles.id, customRole.id));
      }
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.updateRolePermission({
      roleId: customRole!.id,
      permissions: {
        admin: false,
        create: true,
        read: true,
        update: true,
        delete: false,
      },
    });

    expect(result.id).toBe(customRole!.id);
    expect(result.name).toBe(customRole!.name);

    // Verify permissions were updated in database
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
    const decoded = fromBitField(permission!.permission);
    expect(decoded.create).toBe(true);
    expect(decoded.read).toBe(true);
    expect(decoded.update).toBe(true);
    expect(decoded.delete).toBe(false);
    expect(decoded.admin).toBe(false);
  });

  it('should update existing permissions (not create new entry)', async ({
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
        name: `Custom Role ${task.id}`,
        description: 'A custom role for testing',
        profileId: profile.id,
      })
      .returning();

    // Track for cleanup
    onTestFinished(async () => {
      if (customRole) {
        await db.delete(accessRoles).where(eq(accessRoles.id, customRole.id));
      }
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // First update
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

    // Second update
    await caller.updateRolePermission({
      roleId: customRole!.id,
      permissions: {
        admin: false,
        create: false,
        read: true,
        update: true,
        delete: true,
      },
    });

    // Verify only one permission entry exists
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

    // Verify the latest permissions
    const decoded = fromBitField(permissions[0]!.permission);
    expect(decoded.create).toBe(false);
    expect(decoded.read).toBe(true);
    expect(decoded.update).toBe(true);
    expect(decoded.delete).toBe(true);
  });

  it('should not allow non-admin to update permissions', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, memberUsers } = await testData.createProfile({
      users: { admin: 1, member: 1 },
    });

    // Create a custom role for this profile
    const [customRole] = await db
      .insert(accessRoles)
      .values({
        name: `Custom Role ${task.id}`,
        description: 'A custom role for testing',
        profileId: profile.id,
      })
      .returning();

    // Track for cleanup
    onTestFinished(async () => {
      if (customRole) {
        await db.delete(accessRoles).where(eq(accessRoles.id, customRole.id));
      }
    });

    const { session } = await createIsolatedSession(memberUsers[0]!.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.updateRolePermission({
        roleId: customRole!.id,
        permissions: {
          admin: false,
          create: true,
          read: true,
          update: false,
          delete: false,
        },
      }),
    ).rejects.toSatisfy(
      (error: Error & { cause?: Error }) =>
        error.cause?.name === 'AccessControlException',
    );

    // Verify no permissions were created (role should have no permissions)
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

    expect(permissions.length).toBe(0);
  });

  it('should not allow updating permissions for global roles', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Try to update the global Admin role
    await expect(
      caller.updateRolePermission({
        roleId: ROLES.ADMIN.id,
        permissions: {
          admin: true,
          create: true,
          read: true,
          update: true,
          delete: true,
        },
      }),
    ).rejects.toThrow('Cannot modify permissions for global roles');
  });

  it('should throw error when role not found', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    await expect(
      caller.updateRolePermission({
        roleId: nonExistentId,
        permissions: {
          admin: false,
          create: true,
          read: true,
          update: false,
          delete: false,
        },
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('should preserve higher bits (decision capabilities) when updating ACRUD', async ({
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
        name: `Custom Role ${task.id}`,
        description: 'A custom role for testing higher bits',
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

    // First, set ACRUD permissions
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

    // Now manually set higher bits (decision capabilities) directly in DB
    // to simulate decision capabilities being set via the separate endpoint
    const decisionsZone = await db._query.accessZones.findFirst({
      where: (table, { eq }) => eq(table.name, 'decisions'),
    });

    const existingPerm =
      await db._query.accessRolePermissionsOnAccessZones.findFirst({
        where: (table, { eq, and }) =>
          and(
            eq(table.accessRoleId, customRole!.id),
            eq(table.accessZoneId, decisionsZone!.id),
          ),
      });

    // Add decision bits: REVIEW (128) + VOTE (512) = 640
    const decisionBits = 128 | 512; // 640
    await db
      .update(accessRolePermissionsOnAccessZones)
      .set({ permission: existingPerm!.permission | decisionBits })
      .where(eq(accessRolePermissionsOnAccessZones.id, existingPerm!.id));

    // Now update ACRUD permissions — this should NOT clobber the higher bits
    await caller.updateRolePermission({
      roleId: customRole!.id,
      permissions: {
        admin: false,
        create: false,
        read: true,
        update: true,
        delete: false,
      },
    });

    // Verify the final permission value
    const finalPerm =
      await db._query.accessRolePermissionsOnAccessZones.findFirst({
        where: (table, { eq, and }) =>
          and(
            eq(table.accessRoleId, customRole!.id),
            eq(table.accessZoneId, decisionsZone!.id),
          ),
      });

    expect(finalPerm).toBeDefined();

    // ACRUD bits should reflect the second update (read=4, update=2 → 6)
    const acrudBits = finalPerm!.permission & 31;
    const acrud = fromBitField(acrudBits);
    expect(acrud.create).toBe(false);
    expect(acrud.read).toBe(true);
    expect(acrud.update).toBe(true);
    expect(acrud.delete).toBe(false);
    expect(acrud.admin).toBe(false);

    // Higher bits should still be present (REVIEW=128, VOTE=512)
    const higherBits = finalPerm!.permission & ~31;
    expect(higherBits).toBe(decisionBits);
  });

  it('should not allow admin from different profile to update role permissions', async ({
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
        name: `Custom Role ${task.id}`,
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

    // Admin from Profile B should not be able to update Profile A's role
    const { session } = await createIsolatedSession(adminB.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.updateRolePermission({
        roleId: customRole!.id,
        permissions: {
          admin: true,
          create: true,
          read: true,
          update: true,
          delete: true,
        },
      }),
    ).rejects.toSatisfy(
      (error: Error & { cause?: Error }) =>
        error.cause?.name === 'UnauthorizedError',
    );

    // Verify no permissions were created for the role
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

    expect(permissions.length).toBe(0);
  });
});
