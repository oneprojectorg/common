import { grantTestPlatformAdmin } from '@op/test';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { platformAdminRouter } from '.';
import { TestOrganizationDataManager } from '../../../test/helpers/TestOrganizationDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

describe.concurrent('platform.admin.getUser', () => {
  const createCaller = createCallerFactory(platformAdminRouter);

  it('returns a user with their organizations and roles', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser, memberUsers, organization } =
      await testData.createOrganization({
        users: { admin: 1, member: 1 },
      });
    const member = memberUsers[0]!;

    await grantTestPlatformAdmin(adminUser.authUserId);
    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.getUser({ authUserId: member.authUserId });

    expect(result.authUserId).toBe(member.authUserId);
    expect(result.email).toBe(member.email);
    expect(result.isAnonymous).toBe(false);

    const membership = result.organizationUsers?.find(
      (orgUser) => orgUser.organizationId === organization.id,
    );
    expect(membership).toBeDefined();
    expect(
      membership?.roles?.map((roleJunction) => roleJunction.accessRole.name),
    ).toContain('Member');
  });

  it('rejects a caller without the platform admin role', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1 },
      emailDomain: 'example.com',
    });

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.getUser({ authUserId: adminUser.authUserId }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  });

  it('throws NotFoundError for an unknown auth user id', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const { adminUser } = await testData.createOrganization({
      users: { admin: 1 },
    });

    await grantTestPlatformAdmin(adminUser.authUserId);
    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.getUser({ authUserId: randomUUID() }),
    ).rejects.toMatchObject({
      cause: { name: 'NotFoundError' },
    });
  });
});
