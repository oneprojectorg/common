import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating/decision';
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

  it('should reject an unsupported mime type before touching storage', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      adminCaller.decision.uploadOverviewBackgroundImage({
        instanceId: setup.instance.instance.id,
        file: TINY_PNG_BASE64,
        fileName: 'hero.txt',
        mimeType: 'text/plain',
      }),
    ).rejects.toThrow(/unsupported file type/i);
  });

  it('should reject a file over the size cap before touching storage', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    // 'A' is a valid base64 char; ~4.2MB of it decodes to >3MB, over the cap.
    const oversized = 'A'.repeat(4 * 1024 * 1024 + 1024);

    await expect(
      adminCaller.decision.uploadOverviewBackgroundImage({
        instanceId: setup.instance.instance.id,
        file: oversized,
        fileName: 'hero.png',
        mimeType: 'image/png',
      }),
    ).rejects.toThrow(/too large/i);
  });

  it('should reject a malformed data URL before touching storage', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      adminCaller.decision.uploadOverviewBackgroundImage({
        instanceId: setup.instance.instance.id,
        // A data: URL with no comma can't be split into a payload.
        file: 'data:image/png;base64',
        fileName: 'hero.png',
        mimeType: 'image/png',
      }),
    ).rejects.toThrow(/invalid base64/i);
  });
});

describeDecisionAccessTierGating('uploadOverviewBackgroundImage', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.uploadOverviewBackgroundImage({
          instanceId: setup.instance.instance.id,
          file: TINY_PNG_BASE64,
          fileName: 'hero.png',
          mimeType: 'image/png',
        }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'rejects anon-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const caller = await callers.anonJwt();

      await expectFailsAccessTierGate(
        caller.decision.uploadOverviewBackgroundImage({
          instanceId: setup.instance.instance.id,
          file: TINY_PNG_BASE64,
          fileName: 'hero.png',
          mimeType: 'image/png',
        }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'admits confirmed user-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const caller = await callers.userJwt();

      // Past the tier gate; the deeper admin assertion still rejects a
      // non-admin caller (that's not a tier failure).
      await expectPassesAccessTierGate(
        caller.decision.uploadOverviewBackgroundImage({
          instanceId: setup.instance.instance.id,
          file: TINY_PNG_BASE64,
          fileName: 'hero.png',
          mimeType: 'image/png',
        }),
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const caller = await callers.networkJwt(setup.userEmail);

      await expectPassesAccessTierGate(
        caller.decision.uploadOverviewBackgroundImage({
          instanceId: setup.instance.instance.id,
          file: TINY_PNG_BASE64,
          fileName: 'hero.png',
          mimeType: 'image/png',
        }),
      );
    },
  ),
});
