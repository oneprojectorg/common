import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
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

describe.concurrent('getDecisionBySlug', () => {
  it('should return decision profile by slug', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const { slug, profileId } = setup.instance;
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.getDecisionBySlug({ slug });

    expect(result.slug).toBe(slug);
    expect(result.type).toBe('decision');
    expect(result.id).toBe(profileId);
    expect(result.processInstance).toBeDefined();
    // The hot-path slug fetch intentionally skips proposal aggregates — list
    // views get counts from listDecisionProfiles.
    expect(result.processInstance.proposalCount).toBeUndefined();
    expect(result.processInstance.participantCount).toBeUndefined();
  });

  it('should throw error when user does not have access', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Create instance (creator has access by default via createInstanceFromTemplate)
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: false,
    });

    const { slug } = setup.instance;

    // Create a different user who doesn't have access to the instance
    const otherUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [], // Don't grant access to any instances
    });
    const caller = await createAuthenticatedCaller(otherUser.email);

    await expect(
      caller.decision.getDecisionBySlug({ slug }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError', statusCode: 403 },
    });
  });

  it('should throw error for non-existent slug', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.getDecisionBySlug({ slug: 'non-existent-slug' }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError', statusCode: 403 },
    });
  });

  it('should include process and owner information', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const { slug } = setup.instance;
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.getDecisionBySlug({ slug });

    expect(result.processInstance.instanceData.templateId).toBeDefined();
    expect(result.processInstance.owner).toBeDefined();
    expect(result.processInstance.owner?.id).toBe(setup.organization.profileId);
  });
});

describeDecisionAccessTierGating('getDecisionBySlug', {
  noJwtNonPublic: accessTierGatingCell(
    'admits no-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.noJwt();

      await expectPassesAccessTierGate(
        caller.decision.getDecisionBySlug({ slug: instance.slug }),
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
      const instance = setup.instance;

      const caller = await callers.anonJwt();

      await expectPassesAccessTierGate(
        caller.decision.getDecisionBySlug({ slug: instance.slug }),
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
      const instance = setup.instance;

      const caller = await callers.userJwt();

      await expectPassesAccessTierGate(
        caller.decision.getDecisionBySlug({ slug: instance.slug }),
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
      const instance = setup.instance;

      const caller = await callers.networkJwt(setup.userEmail);

      await expectPassesAccessTierGate(
        caller.decision.getDecisionBySlug({ slug: instance.slug }),
      );
    },
  ),
});
