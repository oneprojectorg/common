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

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

describe.concurrent('signOverviewHeroImageUploadUrl', () => {
  it('should reject a non-admin caller before signing', async ({
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
      nonAdminCaller.decision.signOverviewHeroImageUploadUrl({
        instanceId: instance.instance.id,
        fileName: 'hero.png',
      }),
    ).rejects.toThrow();
  });

  it('should require authentication', async () => {
    const caller = createCaller({
      session: null,
      user: null,
    } as never);

    await expect(
      caller.decision.signOverviewHeroImageUploadUrl({
        instanceId: NIL_UUID,
        fileName: 'hero.png',
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
      caller.decision.signOverviewHeroImageUploadUrl({
        instanceId: NIL_UUID,
        fileName: 'hero.png',
      }),
    ).rejects.toThrow(/not found/i);
  });
});

describe.concurrent('updateOverviewHeroImage', () => {
  it('should reject a non-admin caller', async ({ task, onTestFinished }) => {
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
      nonAdminCaller.decision.updateOverviewHeroImage({
        instanceId: instance.instance.id,
        storagePath: `${instance.instance.id}/overview/does-not-exist.png`,
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
      caller.decision.updateOverviewHeroImage({
        instanceId: NIL_UUID,
        storagePath: `${NIL_UUID}/overview/hero.png`,
        mimeType: 'image/png',
      }),
    ).rejects.toThrow(/not found/i);
  });

  it('should reject a storage path with no uploaded object', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    // Admin passes the gate; the storage object was never uploaded, so the
    // trust-boundary check rejects it.
    await expect(
      adminCaller.decision.updateOverviewHeroImage({
        instanceId: setup.instance.instance.id,
        storagePath: `${setup.instance.instance.id}/overview/never-uploaded.png`,
        mimeType: 'image/png',
      }),
    ).rejects.toThrow();
  });
});

describeDecisionAccessTierGating('signOverviewHeroImageUploadUrl', {
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
        caller.decision.signOverviewHeroImageUploadUrl({
          instanceId: setup.instance.instance.id,
          fileName: 'hero.png',
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
        caller.decision.signOverviewHeroImageUploadUrl({
          instanceId: setup.instance.instance.id,
          fileName: 'hero.png',
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
        caller.decision.signOverviewHeroImageUploadUrl({
          instanceId: setup.instance.instance.id,
          fileName: 'hero.png',
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
        caller.decision.signOverviewHeroImageUploadUrl({
          instanceId: setup.instance.instance.id,
          fileName: 'hero.png',
        }),
      );
    },
  ),
});
