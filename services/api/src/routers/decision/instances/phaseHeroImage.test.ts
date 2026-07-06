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
// Phase id seeded by TestDecisionsDataManager.createDecisionSetup.
const PHASE_ID = 'initial';

describe.concurrent('signPhaseHeroImageUploadUrl', () => {
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
      nonAdminCaller.decision.signPhaseHeroImageUploadUrl({
        instanceId: instance.instance.id,
        phaseId: PHASE_ID,
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
      caller.decision.signPhaseHeroImageUploadUrl({
        instanceId: NIL_UUID,
        phaseId: PHASE_ID,
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
      caller.decision.signPhaseHeroImageUploadUrl({
        instanceId: NIL_UUID,
        phaseId: PHASE_ID,
        fileName: 'hero.png',
      }),
    ).rejects.toThrow(/not found/i);
  });
});

describe.concurrent('updatePhaseHeroImage', () => {
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
      nonAdminCaller.decision.updatePhaseHeroImage({
        instanceId: instance.instance.id,
        phaseId: PHASE_ID,
        storagePath: `${instance.instance.id}/phase/${PHASE_ID}/does-not-exist.png`,
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
      caller.decision.updatePhaseHeroImage({
        instanceId: NIL_UUID,
        phaseId: PHASE_ID,
        storagePath: `${NIL_UUID}/phase/${PHASE_ID}/hero.png`,
        mimeType: 'image/png',
      }),
    ).rejects.toThrow(/not found/i);
  });

  it('should return 404 for a non-existent phase', async ({
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
      adminCaller.decision.updatePhaseHeroImage({
        instanceId: setup.instance.instance.id,
        phaseId: 'no-such-phase',
        storagePath: `${setup.instance.instance.id}/phase/no-such-phase/hero.png`,
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

    // Admin passes the gate and the phase exists; the storage object was never
    // uploaded, so the trust-boundary check rejects it.
    await expect(
      adminCaller.decision.updatePhaseHeroImage({
        instanceId: setup.instance.instance.id,
        phaseId: PHASE_ID,
        storagePath: `${setup.instance.instance.id}/phase/${PHASE_ID}/never-uploaded.png`,
        mimeType: 'image/png',
      }),
    ).rejects.toThrow();
  });
});

describe.concurrent('removePhaseHeroImage', () => {
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
      nonAdminCaller.decision.removePhaseHeroImage({
        instanceId: instance.instance.id,
        phaseId: PHASE_ID,
      }),
    ).rejects.toThrow();
  });

  it('should be a no-op for a phase with no hero image', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    const result = await adminCaller.decision.removePhaseHeroImage({
      instanceId: setup.instance.instance.id,
      phaseId: PHASE_ID,
    });
    expect(result.heroImage).toBe('');
  });
});

describeDecisionAccessTierGating('signPhaseHeroImageUploadUrl', {
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
        caller.decision.signPhaseHeroImageUploadUrl({
          instanceId: setup.instance.instance.id,
          phaseId: PHASE_ID,
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
        caller.decision.signPhaseHeroImageUploadUrl({
          instanceId: setup.instance.instance.id,
          phaseId: PHASE_ID,
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
        caller.decision.signPhaseHeroImageUploadUrl({
          instanceId: setup.instance.instance.id,
          phaseId: PHASE_ID,
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
        caller.decision.signPhaseHeroImageUploadUrl({
          instanceId: setup.instance.instance.id,
          phaseId: PHASE_ID,
          fileName: 'hero.png',
        }),
      );
    },
  ),
});
