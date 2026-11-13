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

const legacyInstanceData = {
  currentStateId: 'submission',
  phases: [
    {
      stateId: 'submission',
      plannedStartDate: '2025-09-08',
      plannedEndDate: '2025-09-28',
    },
  ],
  fieldValues: {},
  budget: 0,
  hideBudget: false,
};

const makeInstanceLegacy = async (instanceId: string) => {
  await db
    .update(processInstances)
    .set({ instanceData: legacyInstanceData, processId: null })
    .where(eq(processInstances.id, instanceId));
  await invalidateDecisionInstance(instanceId);
};

describe.concurrent('getConvertedInstanceSlug', () => {
  it('returns the profile slug of a current instance the caller can read', async ({
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

  it('returns null to a caller who cannot read the instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: false,
    });
    const separateOrgSetup = await testData.createDecisionSetup({
      instanceCount: 0,
    });
    const outsider = await testData.createMemberUser({
      organization: separateOrgSetup.organization,
      instanceProfileIds: [],
    });

    const outsiderCaller = await createAuthenticatedCaller(outsider.email);
    const publicCaller = createCaller(await createTestContextWithSession(null));

    const [outsiderResult, publicResult] = await Promise.all([
      outsiderCaller.decision.getConvertedInstanceSlug({
        instanceId: setup.instance.instance.id,
      }),
      publicCaller.decision.getConvertedInstanceSlug({
        instanceId: setup.instance.instance.id,
      }),
    ]);

    expect(outsiderResult).toEqual({ slug: null });
    expect(publicResult).toEqual({ slug: null });
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
