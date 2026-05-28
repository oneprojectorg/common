import { ProposalStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { describeDecisionGating } from '../../../test/helpers/decisionGating';
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

    const { slug, profileId } = setup.instances[0]!;
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.getDecisionBySlug({ slug });

    expect(result.slug).toBe(slug);
    expect(result.type).toBe('decision');
    expect(result.id).toBe(profileId);
    expect(result.processInstance).toBeDefined();
    expect(result.processInstance.proposalCount).toBe(0);
    expect(result.processInstance.participantCount).toBe(0);
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

    const { slug } = setup.instances[0]!;

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

    const { slug } = setup.instances[0]!;
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.getDecisionBySlug({ slug });

    expect(result.processInstance.instanceData.templateId).toBeDefined();
    expect(result.processInstance.owner).toBeDefined();
    expect(result.processInstance.owner?.id).toBe(setup.organization.profileId);
  });

  it('should exclude draft proposals from stats', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const draftProposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: {
        title: 'Draft proposal',
        description: 'Still drafting',
      },
    });

    const submittedProposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Submitted proposal' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const submittedResult = await caller.decision.submitProposal({
      proposalId: submittedProposal.id,
    });

    expect(draftProposal.status).toBe(ProposalStatus.DRAFT);
    expect(submittedResult.status).toBe(ProposalStatus.SUBMITTED);

    const result = await caller.decision.getDecisionBySlug({
      slug: instance.slug,
    });

    expect(result.processInstance.proposalCount).toBe(1);
    expect(result.processInstance.participantCount).toBe(1);
  });
});

// Public-mode gating matrix: getDecisionBySlug sits on `openProcedure`. The
// PUBLIC role grants only `decisions: READ`; the ANONYMOUS role grants
// `decisions: READ | SUBMIT_PROPOSALS`. Common-JWT (owner) always allowed.
describeDecisionGating('getDecisionBySlug', {
  noJwtPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }
    await testData.setInstancePublic(instance.instance.id);

    const caller = await callers.noJwt();

    const result = await caller.decision.getDecisionBySlug({
      slug: instance.slug,
    });

    expect(result.slug).toBe(instance.slug);
    expect(result.processInstance).toBeDefined();
    // PUBLIC role grants `decisions: READ` only.
    expect(result.processInstance.access?.read).toBe(true);
    expect(result.processInstance.access?.admin).toBe(false);
  },

  anonJwtPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }
    await testData.setInstancePublic(instance.instance.id);

    const caller = await callers.anonJwt();

    const result = await caller.decision.getDecisionBySlug({
      slug: instance.slug,
    });

    expect(result.slug).toBe(instance.slug);
    expect(result.processInstance).toBeDefined();
    // ANONYMOUS role grants `decisions: READ | SUBMIT_PROPOSALS`.
    expect(result.processInstance.access?.read).toBe(true);
    expect(result.processInstance.access?.admin).toBe(false);
  },

  commonJwtPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }
    await testData.setInstancePublic(instance.instance.id);

    const caller = await callers.commonJwt(setup.userEmail);

    const result = await caller.decision.getDecisionBySlug({
      slug: instance.slug,
    });

    expect(result.slug).toBe(instance.slug);
    // Common-JWT owner has admin access regardless of public-mode toggle.
    expect(result.processInstance.access?.read).toBe(true);
    expect(result.processInstance.access?.admin).toBe(true);
  },

  noJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }
    // Non-public by default — closed-network gate.

    const caller = await callers.noJwt();

    await expect(
      caller.decision.getDecisionBySlug({ slug: instance.slug }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  },

  anonJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }
    // Non-public by default — closed-network gate.

    const caller = await callers.anonJwt();

    await expect(
      caller.decision.getDecisionBySlug({ slug: instance.slug }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  },

  commonJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }
    // Non-public — closed-network gate. Common-JWT (allow-listed owner)
    // still allowed via org-level access.

    const caller = await callers.commonJwt(setup.userEmail);

    const result = await caller.decision.getDecisionBySlug({
      slug: instance.slug,
    });

    expect(result.slug).toBe(instance.slug);
    expect(result.processInstance.access?.read).toBe(true);
    expect(result.processInstance.access?.admin).toBe(true);
  },
});
