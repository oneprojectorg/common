import { db } from '@op/db/client';
import { accessRoles } from '@op/db/schema';
import { AccessControlException, fromBitField } from 'access-zones';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { UnauthorizedError } from '@op/common';

import profileRouter from '.';
import { TestProfileUserDataManager } from '../../test/helpers/TestProfileUserDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

describe.concurrent('profile.createRole', () => {
  const createCaller = createCallerFactory(profileRouter);

  it('should allow admin to create a role', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.createRole({
      profileId: profile.id,
      name: `Test Role ${task.id}`,
      permissions: {
        admin: false,
        create: true,
        read: true,
        update: false,
        delete: false,
      },
    });

    // Track for cleanup
    onTestFinished(async () => {
      if (result.id) {
        await db.delete(accessRoles).where(eq(accessRoles.id, result.id));
      }
    });

    expect(result.id).toBeDefined();
    expect(result.name).toBe(`Test Role ${task.id}`);
    expect(result.permissions).toEqual({
      admin: false,
      create: true,
      read: true,
      update: false,
      delete: false,
    });

    // Verify permissions were actually persisted in database
    const decisionsZone = await db._query.accessZones.findFirst({
      where: (table, { eq }) => eq(table.name, 'decisions'),
    });

    const permission =
      await db._query.accessRolePermissionsOnAccessZones.findFirst({
        where: (table, { eq, and }) =>
          and(
            eq(table.accessRoleId, result.id),
            eq(table.accessZoneId, decisionsZone!.id),
          ),
      });

    expect(permission).toBeDefined();
    const decoded = fromBitField(permission!.permission);
    expect(decoded.create).toBe(true);
    expect(decoded.read).toBe(true);
    expect(decoded.update).toBe(false);
    expect(decoded.delete).toBe(false);
    expect(decoded.admin).toBe(false);
  });

  it('should not allow non-admin to create a role', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, memberUsers } = await testData.createProfile({
      users: { admin: 1, member: 1 },
    });

    const { session } = await createIsolatedSession(memberUsers[0]!.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.createRole({
        profileId: profile.id,
        name: `Test Role ${task.id}`,
        permissions: {
          admin: false,
          create: true,
          read: true,
          update: false,
          delete: false,
        },
      }),
    ).rejects.toThrow(AccessControlException);
  });

  it('should not allow user without profile access to create a role', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Create another profile with a different admin
    const { adminUser: otherAdmin } = await testData.createProfile({
      users: { admin: 1 },
    });

    const { session } = await createIsolatedSession(otherAdmin.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.createRole({
        profileId: profile.id,
        name: `Test Role ${task.id}`,
        permissions: {
          admin: false,
          create: true,
          read: true,
          update: false,
          delete: false,
        },
      }),
    ).rejects.toThrow(UnauthorizedError);
  });
});
