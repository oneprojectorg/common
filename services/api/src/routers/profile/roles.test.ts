import { db } from '@op/db/client';
import { accessRoles } from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import profileRouter from '.';
import { TestProfileUserDataManager } from '../../test/helpers/TestProfileUserDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

describe.concurrent('profile.listRoles', () => {
  const createCaller = createCallerFactory(profileRouter);

  it('should return global roles when no profileId provided', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.listRoles({
      limit: 100,
    });

    // Should include the seeded Admin and Member roles
    const roleNames = result.items.map((r) => r.name);
    expect(roleNames).toContain(ROLES.ADMIN.name);
    expect(roleNames).toContain(ROLES.MEMBER.name);

    // Verify these are the seeded roles by checking their IDs
    const adminRole = result.items.find((r) => r.id === ROLES.ADMIN.id);
    const memberRole = result.items.find((r) => r.id === ROLES.MEMBER.id);
    expect(adminRole).toBeDefined();
    expect(memberRole).toBeDefined();
  });

  it('should return profile-specific roles when profileId provided', async ({
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

    // Track the custom role for cleanup
    onTestFinished(async () => {
      if (customRole) {
        await db.delete(accessRoles).where(eq(accessRoles.id, customRole.id));
      }
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.listRoles({
      profileId: profile.id,
      limit: 100,
    });

    // Should only include the custom role, not global roles
    expect(result.items.length).toBe(1);
    expect(result.items[0]?.id).toBe(customRole?.id);
    expect(result.items[0]?.name).toBe(customRole?.name);
    expect(result.items[0]?.description).toBe(customRole?.description);

    // Should NOT include global seeded roles
    const roleIds = result.items.map((r) => r.id);
    expect(roleIds).not.toContain(ROLES.ADMIN.id);
    expect(roleIds).not.toContain(ROLES.MEMBER.id);
  });

  it('should return empty results for profile with no custom roles', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.listRoles({
      profileId: profile.id,
      limit: 100,
    });

    // Should be empty since no custom roles were created for this profile
    expect(result.items).toHaveLength(0);
    expect(result.next).toBeNull();
  });

  it('should support pagination', async ({ task, onTestFinished }) => {
    const testData = new TestProfileUserDataManager(task.id, onTestFinished);
    const { profile, adminUser } = await testData.createProfile({
      users: { admin: 1 },
    });

    // Create multiple custom roles for this profile
    const roleNames = ['Alpha Role', 'Beta Role', 'Gamma Role', 'Delta Role'];
    const createdRoles = await db
      .insert(accessRoles)
      .values(
        roleNames.map((name) => ({
          name: `${name} ${task.id}`,
          description: `Test role ${name}`,
          profileId: profile.id,
        })),
      )
      .returning();

    // Track the custom roles for cleanup
    onTestFinished(async () => {
      for (const role of createdRoles) {
        await db.delete(accessRoles).where(eq(accessRoles.id, role.id));
      }
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // First page with limit 2
    const firstPage = await caller.listRoles({
      profileId: profile.id,
      limit: 2,
    });

    expect(firstPage.items.length).toBe(2);
    expect(firstPage.next).not.toBeNull();

    // Second page using cursor
    const secondPage = await caller.listRoles({
      profileId: profile.id,
      limit: 2,
      cursor: firstPage.next,
    });

    expect(secondPage.items.length).toBe(2);

    // Verify no duplicates between pages
    const firstPageIds = new Set(firstPage.items.map((r) => r.id));
    const secondPageIds = new Set(secondPage.items.map((r) => r.id));
    const intersection = [...firstPageIds].filter((id) =>
      secondPageIds.has(id),
    );
    expect(intersection).toHaveLength(0);

    // All 4 roles should be found across both pages
    const allIds = [...firstPageIds, ...secondPageIds];
    expect(allIds.length).toBe(4);
  });

});
