import {
  TestDecisionsDataManager,
  createDevelopPhaseSetup,
  createDevelopProposalsMember,
  grantInstanceReviewerRole,
  testDevelopSchema,
} from '@op/common/testing';
import { db } from '@op/db/client';
import {
  ProcessStatus,
  ProposalRelationshipType,
  ProposalStatus,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { UnauthorizedError, ValidationError } from '../../utils';
import { createDevelopedProposal } from './createDevelopedProposal';

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

async function expectRefused(
  attempt: Promise<unknown>,
  errorClass: typeof ValidationError | typeof UnauthorizedError,
  message?: string,
) {
  const error = await attempt.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(errorClass);
  if (message) {
    expect(error).toHaveProperty('message', expect.stringContaining(message));
  }
}

describe.concurrent('createDevelopedProposal', () => {
  it('lets a caller with Develop Proposals create a draft and writes one developed edge per source', async ({
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

    const draft = await createDevelopedProposal({
      data: {
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: { title: 'Developed' },
      },
      user: developer.user,
    });
    testData.trackProfileForCleanup(draft.profileId);

    expect(draft.status).toBe(ProposalStatus.DRAFT);
    expect(draft.profile.name).toBe('Developed');
    await expect(readDevelopedSourceIds(draft.id)).resolves.toEqual([
      source.id,
    ]);
  });

  it('lets an admin create a draft', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });

    const draft = await createDevelopedProposal({
      data: {
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: { title: 'Admin developed' },
      },
      user: setup.user,
    });
    testData.trackProfileForCleanup(draft.profileId);

    await expect(readDevelopedSourceIds(draft.id)).resolves.toEqual([
      source.id,
    ]);
  });

  it('refuses a caller with Review and without Develop Proposals with UnauthorizedError', async ({
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
    await grantInstanceReviewerRole({
      instanceProfileId: setup.instance.profileId,
      authUserId: reviewer.authUserId,
      email: reviewer.email,
      roleName: `Reviewer ${reviewer.authUserId}`,
    });

    await expectRefused(
      createDevelopedProposal({
        data: {
          processInstanceId: instanceId,
          sourceProposalIds: [source.id],
          proposalData: { title: 'Refused' },
        },
        user: reviewer.user,
      }),
      UnauthorizedError,
    );
  });

  it('refuses a participant without Develop Proposals with UnauthorizedError', async ({
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

    await expectRefused(
      createDevelopedProposal({
        data: {
          processInstanceId: instanceId,
          sourceProposalIds: [source.id],
          proposalData: { title: 'Refused' },
        },
        user: participant.user,
      }),
      UnauthorizedError,
    );
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

    await expectRefused(
      createDevelopedProposal({
        data: {
          processInstanceId: instanceId,
          sourceProposalIds: [source.id],
          proposalData: { title: 'Refused' },
        },
        user: setup.user,
      }),
      ValidationError,
      'cannot be developed',
    );
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

    await expectRefused(
      createDevelopedProposal({
        data: {
          processInstanceId: instanceId,
          sourceProposalIds: [foreign.id],
          proposalData: { title: 'Refused' },
        },
        user: setup.user,
      }),
      ValidationError,
      foreign.id,
    );
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

    const error = await createDevelopedProposal({
      data: {
        processInstanceId: instanceId,
        sourceProposalIds: [submitted.id, draft.id],
        proposalData: { title: 'Refused' },
      },
      user: setup.user,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toHaveProperty('message', expect.stringContaining(draft.id));
    expect(error).toHaveProperty(
      'message',
      expect.not.stringContaining(submitted.id),
    );
  });

  it('refuses a source that was not in the previous phase', async ({
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

    await expectRefused(
      createDevelopedProposal({
        data: {
          processInstanceId: instanceId,
          sourceProposalIds: [lateProposal.id],
          proposalData: { title: 'Refused' },
        },
        user: setup.user,
      }),
      ValidationError,
      lateProposal.id,
    );
  });

  it('refuses a source listed twice', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });

    await expectRefused(
      createDevelopedProposal({
        data: {
          processInstanceId: instanceId,
          sourceProposalIds: [source.id, source.id],
          proposalData: { title: 'Refused' },
        },
        user: setup.user,
      }),
      ValidationError,
      source.id,
    );
  });

  it('allows one source to be developed into two drafts', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });

    const first = await createDevelopedProposal({
      data: {
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: { title: 'First' },
      },
      user: setup.user,
    });
    testData.trackProfileForCleanup(first.profileId);
    const second = await createDevelopedProposal({
      data: {
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: { title: 'Second' },
      },
      user: setup.user,
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
