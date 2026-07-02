import { IMAGE_UPLOAD_SIZE_LIMIT } from '@op/common';
import { Buffer } from 'node:buffer';
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
  supabaseTestAdminClient,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

type AuthenticatedCaller = Awaited<
  ReturnType<typeof createAuthenticatedCaller>
>;

// 1x1 PNG; small enough to keep tests cheap, still a valid image.
const TEST_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const TEST_PNG_BUFFER = Buffer.from(TEST_PNG_BASE64, 'base64');

/**
 * Runs the production hero-image upload sequence end-to-end via a tRPC caller:
 * sign URL, PUT to storage (service-role admin client), record. Returns the
 * signed path so callers can assert on it.
 */
async function uploadHeroImageForTest({
  caller,
  instanceId,
  fileName = 'hero.png',
  mimeType = 'image/png',
  body = TEST_PNG_BUFFER,
}: {
  caller: AuthenticatedCaller;
  instanceId: string;
  fileName?: string;
  mimeType?: string;
  body?: Buffer;
}) {
  const signed = await caller.decision.signOverviewHeroImageUploadUrl({
    instanceId,
    fileName,
  });

  const { error } = await supabaseTestAdminClient.storage
    .from('assets')
    .upload(signed.storagePath, body, { contentType: mimeType, upsert: false });
  if (error) {
    throw new Error(`hero image test upload failed: ${error.message}`);
  }

  return signed;
}

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

  it('should record a validly uploaded image and persist its path', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    const signed = await uploadHeroImageForTest({
      caller: adminCaller,
      instanceId,
    });

    const result = await adminCaller.decision.updateOverviewHeroImage({
      instanceId,
      storagePath: signed.storagePath,
      mimeType: 'image/png',
    });
    expect(result.heroImage).toBe(signed.storagePath);

    // Round-trips through getInstance so the persisted path is visible to the
    // overview page.
    const fetched = await adminCaller.decision.getInstance({ instanceId });
    expect(fetched.instanceData?.overview?.heroImage).toBe(signed.storagePath);
  });

  it('should reject a non-image upload even though PDF is on the allowlist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    // A PDF passes the shared allowlist + prefix + declared==stored checks, so
    // this proves the image-only guard specifically (not the generic
    // allowlist) rejects it.
    const signed = await uploadHeroImageForTest({
      caller: adminCaller,
      instanceId,
      fileName: 'hero.pdf',
      mimeType: 'application/pdf',
      body: Buffer.from('%PDF-1.4 not really a pdf'),
    });

    await expect(
      adminCaller.decision.updateOverviewHeroImage({
        instanceId,
        storagePath: signed.storagePath,
        mimeType: 'application/pdf',
      }),
    ).rejects.toThrow(/image/i);
  });

  it('should reject an upload over the image size cap', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    const signed = await uploadHeroImageForTest({
      caller: adminCaller,
      instanceId,
      body: Buffer.alloc(IMAGE_UPLOAD_SIZE_LIMIT + 1),
    });

    await expect(
      adminCaller.decision.updateOverviewHeroImage({
        instanceId,
        storagePath: signed.storagePath,
        mimeType: 'image/png',
      }),
    ).rejects.toThrow(/size/i);
  });
});

describe.concurrent('removeOverviewHeroImage', () => {
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
      nonAdminCaller.decision.removeOverviewHeroImage({
        instanceId: instance.instance.id,
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
      caller.decision.removeOverviewHeroImage({ instanceId: NIL_UUID }),
    ).rejects.toThrow(/not found/i);
  });

  it('should clear the hero image while preserving other overview fields', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    const headline = `Overview headline ${task.id}`;
    await adminCaller.decision.updateDecisionInstance({
      instanceId,
      overview: { headline },
    });

    const signed = await uploadHeroImageForTest({
      caller: adminCaller,
      instanceId,
    });
    await adminCaller.decision.updateOverviewHeroImage({
      instanceId,
      storagePath: signed.storagePath,
      mimeType: 'image/png',
    });

    const result = await adminCaller.decision.removeOverviewHeroImage({
      instanceId,
    });
    expect(result.heroImage).toBe('');

    // The partial-overview merge must clear only heroImage, not the headline.
    const fetched = await adminCaller.decision.getInstance({ instanceId });
    expect(fetched.instanceData?.overview?.heroImage).toBe('');
    expect(fetched.instanceData?.overview?.headline).toBe(headline);
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
