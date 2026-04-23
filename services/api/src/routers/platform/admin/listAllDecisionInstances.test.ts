import { describe, expect, it } from 'vitest';

import { platformAdminRouter } from '.';
import { TestOrganizationDataManager } from '../../../test/helpers/TestOrganizationDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

describe.concurrent('platform.admin.listAllDecisionInstances', () => {
  const createCaller = createCallerFactory(platformAdminRouter);

  it('should throw when a non-platform-admin tries to list decision instances', async ({
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

    await expect(() => caller.listAllDecisionInstances()).rejects.toThrow();
  });
});
