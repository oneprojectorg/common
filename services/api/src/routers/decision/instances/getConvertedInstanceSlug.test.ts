import { invalidateDecisionInstance } from '@op/common';
import { TestDecisionsDataManager } from '@op/common/testing';
import { processInstances } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating/decision';
import {
  createAuthenticatedCaller,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

// `currentStateId` in the JSON is the whole legacy marker.
const legacyInstanceData = { currentStateId: 'submission' };

const makeInstanceLegacy = async (instanceId: string) => {
  await db
    .update(processInstances)
    .set({ instanceData: legacyInstanceData, processId: null })
    .where(eq(processInstances.id, instanceId));
  await invalidateDecisionInstance(instanceId);
};

describe.concurrent('getConvertedInstanceSlug', () => {
  // grantAccess assigns the decision Admin role.
  it('returns the profile slug to a decision admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.getConvertedInstanceSlug({
      instanceId: setup.instance.instance.id,
    });

    expect(result).toEqual({ slug: setup.instance.slug });
  });

  it('returns null for a legacy instance that has a profile slug', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    await makeInstanceLegacy(setup.instance.instance.id);

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.getConvertedInstanceSlug({
      instanceId: setup.instance.instance.id,
    });

    expect(result).toEqual({ slug: null });
  });

  it('returns null for an instance that does not exist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.getConvertedInstanceSlug({
      instanceId: '00000000-0000-4000-8000-000000000000',
    });

    expect(result).toEqual({ slug: null });
  });

  it('returns the profile slug to a decision member with read access', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });
    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });

    const caller = await createAuthenticatedCaller(member.email);
    const result = await caller.decision.getConvertedInstanceSlug({
      instanceId: setup.instance.instance.id,
    });

    expect(result).toEqual({ slug: setup.instance.slug });
  });

  it('returns the profile slug to an anonymous visitor of a public decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });
    await testData.makeDecisionPublic(setup.instance.profileId);

    const visitor = createCaller(await createTestContextWithSession(null));
    const result = await visitor.decision.getConvertedInstanceSlug({
      instanceId: setup.instance.instance.id,
    });

    expect(result).toEqual({ slug: setup.instance.slug });
  });

  it('returns null to a user from another organization', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });
    const separateOrgSetup = await testData.createDecisionSetup({
      instanceCount: 0,
    });
    const outsider = await testData.createMemberUser({
      organization: separateOrgSetup.organization,
      instanceProfileIds: [],
    });

    const caller = await createAuthenticatedCaller(outsider.email);
    const result = await caller.decision.getConvertedInstanceSlug({
      instanceId: setup.instance.instance.id,
    });

    expect(result).toEqual({ slug: null });
  });

  it('returns null to an anonymous visitor of a private decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });

    const visitor = createCaller(await createTestContextWithSession(null));
    const result = await visitor.decision.getConvertedInstanceSlug({
      instanceId: setup.instance.instance.id,
    });

    expect(result).toEqual({ slug: null });
  });

  // /decisions/[slug] has no org fallback, so redirecting this caller would land on a forbidden page.
  it('returns null to an owner-org member with no role on the decision profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const orgMember = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });

    const caller = await createAuthenticatedCaller(orgMember.email);
    const instanceId = setup.instance.instance.id;

    await expect(
      caller.decision.getConvertedInstanceSlug({ instanceId }),
    ).resolves.toEqual({ slug: null });
    await expect(
      caller.decision.getDecisionBySlug({ slug: setup.instance.slug }),
    ).rejects.toThrow();
  });
});

describeDecisionAccessTierGating('getConvertedInstanceSlug', {
  noJwtNonPublic: accessTierGatingCell(
    'admits no-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });

      const caller = await callers.noJwt();

      await expectPassesAccessTierGate(
        caller.decision.getConvertedInstanceSlug({
          instanceId: setup.instance.instance.id,
        }),
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'admits anon-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });

      const caller = await callers.anonJwt();

      await expectPassesAccessTierGate(
        caller.decision.getConvertedInstanceSlug({
          instanceId: setup.instance.instance.id,
        }),
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'admits user-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });

      const caller = await callers.userJwt();

      await expectPassesAccessTierGate(
        caller.decision.getConvertedInstanceSlug({
          instanceId: setup.instance.instance.id,
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
        caller.decision.getConvertedInstanceSlug({
          instanceId: setup.instance.instance.id,
        }),
      );
    },
  ),
});
