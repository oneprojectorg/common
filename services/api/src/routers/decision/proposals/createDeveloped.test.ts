import {
  TEST_PERMISSION_BITS,
  TestDecisionsDataManager,
  createCategoryReviewerWithTerm,
  createDevelopPhaseSetup,
  createDevelopProposalsMember,
  grantInstanceRole,
  testDevelopSchema,
} from '@op/common/testing';
import {
  ProcessStatus,
  ProposalRelationshipType,
  ProposalStatus,
  processInstances,
  proposals,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { db, eq } from '@op/db/test';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
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

const readDevelopedSourceIds = async (targetProposalId: string) => {
  const edges = await db.query.proposalRelationships.findMany({
    where: {
      targetProposalId,
      relationshipType: ProposalRelationshipType.DEVELOPED,
    },
    columns: { sourceProposalId: true },
  });
  return edges.map((edge) => edge.sourceProposalId);
};

const NOT_AUTHORIZED = {
  cause: { name: 'UnauthorizedError', message: 'Not authorized' },
};

describe.concurrent('createDevelopedProposal', () => {
  it('lets a caller with Develop Proposals and no Review or Submit bit create a draft and writes one developed edge per source', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const developer = await createDevelopProposalsMember({
      testData,
      setup,
    });
    const caller = await createAuthenticatedCaller(developer.email);

    const draft = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: { title: 'Developed' },
    });
    testData.trackProfileForCleanup(draft.profileId);

    expect(draft.status).toBe(ProposalStatus.DRAFT);
    expect(draft.profile.name).toBe('Developed');
    await expect(readDevelopedSourceIds(draft.id)).resolves.toEqual([
      source.id,
    ]);
  });

  it('lets a profile admin create a draft', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const draft = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: { title: 'Admin developed' },
    });
    testData.trackProfileForCleanup(draft.profileId);

    await expect(readDevelopedSourceIds(draft.id)).resolves.toEqual([
      source.id,
    ]);
  });

  it('lets a caller with the decisions Admin permission and no Develop Proposals bit create a draft', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const decisionsAdmin = await testData.createMemberUser({
      organization: setup.organization,
    });
    await grantInstanceRole({
      instanceProfileId: setup.instance.profileId,
      authUserId: decisionsAdmin.authUserId,
      email: decisionsAdmin.email,
      roleName: `Decisions Admin ${decisionsAdmin.authUserId}`,
      decisionsPermission:
        TEST_PERMISSION_BITS.READ | TEST_PERMISSION_BITS.ADMIN,
    });
    const caller = await createAuthenticatedCaller(decisionsAdmin.email);

    const draft = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: { title: 'Developed' },
    });
    testData.trackProfileForCleanup(draft.profileId);

    await expect(readDevelopedSourceIds(draft.id)).resolves.toEqual([
      source.id,
    ]);
  });

  it('refuses a caller with Review, Submit and a category-reviewer row for the phase but without Develop Proposals', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const reviewer = await testData.createMemberUser({
      organization: setup.organization,
    });
    await grantInstanceRole({
      instanceProfileId: setup.instance.profileId,
      authUserId: reviewer.authUserId,
      email: reviewer.email,
      roleName: `Reviewer ${reviewer.authUserId}`,
      decisionsPermission:
        TEST_PERMISSION_BITS.READ |
        TEST_PERMISSION_BITS.REVIEW |
        TEST_PERMISSION_BITS.SUBMIT_PROPOSALS,
    });
    await createCategoryReviewerWithTerm({
      processInstanceId: instanceId,
      reviewerProfileId: reviewer.profileId,
      phaseId: 'final',
      onTestFinished,
    });
    const caller = await createAuthenticatedCaller(reviewer.email);

    await expect(
      caller.decision.createDevelopedProposal({
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: { title: 'Refused' },
      }),
    ).rejects.toMatchObject(NOT_AUTHORIZED);
  });

  it('refuses a participant without Develop Proposals', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const participant = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });
    const caller = await createAuthenticatedCaller(participant.email);

    await expect(
      caller.decision.createDevelopedProposal({
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: { title: 'Refused' },
      }),
    ).rejects.toMatchObject(NOT_AUTHORIZED);
  });

  it('refuses an admin of the owning organization with no role on the instance profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const orgAdmin = await testData.createMemberUser({
      organization: setup.organization,
      orgRoleId: ROLES.ADMIN.id,
    });
    const caller = await createAuthenticatedCaller(orgAdmin.email);

    await expect(
      caller.decision.createDevelopedProposal({
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: { title: 'Refused' },
      }),
    ).rejects.toMatchObject(NOT_AUTHORIZED);
  });

  it('refuses when the current phase is not a develop phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      processSchema: testDevelopSchema,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instance.instance.id;
    const source = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'Source' },
      status: ProposalStatus.SUBMITTED,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.createDevelopedProposal({
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: { title: 'Refused' },
      }),
    ).rejects.toMatchObject({
      cause: {
        name: 'ValidationError',
        message: expect.stringMatching(
          /^Proposals cannot be developed in the .+ phase$/,
        ),
      },
    });
  });

  it('refuses on an instance without a decision profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await db
      .update(processInstances)
      .set({ profileId: null })
      .where(eq(processInstances.id, instanceId));

    try {
      await expect(
        caller.decision.createDevelopedProposal({
          processInstanceId: instanceId,
          sourceProposalIds: [source.id],
          proposalData: { title: 'Refused' },
        }),
      ).rejects.toMatchObject({
        cause: {
          name: 'UnauthorizedError',
          message: "You don't have access to do this",
        },
      });
    } finally {
      await db
        .update(processInstances)
        .set({ profileId: setup.instance.profileId })
        .where(eq(processInstances.id, instanceId));
    }
  });

  it('refuses a source from another instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createDevelopPhaseSetup({
      testData,
      instanceCount: 2,
    });
    const otherInstance = setup.instances[1];
    if (!otherInstance) {
      throw new Error('Second instance not created');
    }
    const foreign = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: otherInstance.instance.id,
      proposalData: { title: 'Foreign' },
      status: ProposalStatus.SUBMITTED,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.createDevelopedProposal({
        processInstanceId: instanceId,
        sourceProposalIds: [foreign.id],
        proposalData: { title: 'Refused' },
      }),
    ).rejects.toMatchObject({
      cause: {
        name: 'ValidationError',
        message: expect.stringContaining(foreign.id),
      },
    });
  });

  it('refuses a draft source and names it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      processSchema: testDevelopSchema,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instance.instance.id;
    const [submitted, draft] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title: 'Submitted' },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title: 'Draft' },
      }),
    ]);
    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'initial',
      toPhaseId: 'final',
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.createDevelopedProposal({
        processInstanceId: instanceId,
        sourceProposalIds: [submitted.id, draft.id],
        proposalData: { title: 'Refused' },
      }),
    ).rejects.toMatchObject({
      cause: {
        name: 'ValidationError',
        message: `These proposals cannot be developed: ${draft.id}`,
      },
    });
  });

  it('accepts a source from a phase other than the previous one', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createDevelopPhaseSetup({ testData });
    const lateProposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'Created in the develop phase' },
      status: ProposalStatus.SUBMITTED,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const draft = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [lateProposal.id],
      proposalData: { title: 'Developed' },
    });
    testData.trackProfileForCleanup(draft.profileId);

    await expect(readDevelopedSourceIds(draft.id)).resolves.toEqual([
      lateProposal.id,
    ]);
  });

  it('refuses a rejected source and names it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    await db
      .update(proposals)
      .set({ status: ProposalStatus.REJECTED })
      .where(eq(proposals.id, source.id));
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.createDevelopedProposal({
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: { title: 'Refused' },
      }),
    ).rejects.toMatchObject({
      cause: {
        name: 'ValidationError',
        message: `These proposals cannot be developed: ${source.id}`,
      },
    });
  });

  it('writes one edge per source when a source is listed twice', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const draft = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id, source.id],
      proposalData: { title: 'Developed' },
    });
    testData.trackProfileForCleanup(draft.profileId);

    await expect(readDevelopedSourceIds(draft.id)).resolves.toEqual([
      source.id,
    ]);
  });

  it('allows one source to be developed into two drafts', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const first = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: { title: 'First' },
    });
    testData.trackProfileForCleanup(first.profileId);
    const second = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: { title: 'Second' },
    });
    testData.trackProfileForCleanup(second.profileId);

    await expect(readDevelopedSourceIds(first.id)).resolves.toEqual([
      source.id,
    ]);
    await expect(readDevelopedSourceIds(second.id)).resolves.toEqual([
      source.id,
    ]);
  });
});
