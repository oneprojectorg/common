import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

// A 1x1 transparent PNG — enough to pass mime/size validation; these tests
// assert the auth gate, which runs before any storage write.
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe.concurrent('uploadOverviewBackgroundImage', () => {
  it('should reject a non-admin caller before touching storage', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;

    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    const nonAdminCaller = await createAuthenticatedCaller(memberUser.email);

    await expect(
      nonAdminCaller.decision.uploadOverviewBackgroundImage({
        instanceId: instance.instance.id,
        file: TINY_PNG_BASE64,
        fileName: 'hero.png',
        mimeType: 'image/png',
      }),
    ).rejects.toThrow();
  });

  it('should require authentication', async () => {
    const caller = createCaller({
      session: null,
      user: null,
    } as never);

    await expect(
      caller.decision.uploadOverviewBackgroundImage({
        instanceId: '00000000-0000-0000-0000-000000000000',
        file: TINY_PNG_BASE64,
        fileName: 'hero.png',
        mimeType: 'image/png',
      }),
    ).rejects.toThrow();
  });

  it('should return 404 for a non-existent instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: true,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.uploadOverviewBackgroundImage({
        instanceId: '00000000-0000-0000-0000-000000000000',
        file: TINY_PNG_BASE64,
        fileName: 'hero.png',
        mimeType: 'image/png',
      }),
    ).rejects.toThrow(/not found/i);
  });
});
