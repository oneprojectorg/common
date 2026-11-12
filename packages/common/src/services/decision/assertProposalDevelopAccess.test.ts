import {
  TestDecisionsDataManager,
  createCategoryReviewerWithTerm,
} from '@op/common/testing';
import { db } from '@op/db/client';
import { profileUsers } from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { describe, expect, it } from 'vitest';

import { UnauthorizedError, ValidationError } from '../../utils';
import { assertProposalDevelopAccess } from './assertProposalDevelopAccess';
import { createDecisionRole } from './decisionRoles';
import type { DecisionInstanceData } from './schemas/instanceData';

const PHASE_ID = 'initial';

type ProposalRules = NonNullable<
  NonNullable<DecisionInstanceData['phases'][number]['rules']>['proposals']
>;

type Setup = Awaited<
  ReturnType<TestDecisionsDataManager['createDecisionSetup']>
>;

type CreatedInstance = Setup['instances'][number];

/** The instance as the helper reads it, with the current phase's rules replaced. */
function withProposalRules(
  created: CreatedInstance,
  proposals: ProposalRules,
): Parameters<typeof assertProposalDevelopAccess>[0]['instance'] {
  const { instance } = created;
  return {
    id: instance.id,
    profileId: instance.profileId,
    instanceData: {
      phases: instance.instanceData.phases.map((phase) =>
        phase.phaseId === PHASE_ID
          ? { ...phase, rules: { ...phase.rules, proposals } }
          : phase,
      ),
    },
  };
}

/**
 * A member of the decision whose only grant on the instance profile is a
 * role with the given decision bits (no built-in Member role, so no Submit
 * bit unless asked for).
 */
async function createMemberWithRole({
  testData,
  setup,
  review,
  submitProposals,
  admin = false,
  testId,
}: {
  testData: TestDecisionsDataManager;
  setup: Setup;
  review: boolean;
  submitProposals: boolean;
  admin?: boolean;
  testId: string;
}) {
  const instanceProfileId = setup.instance.profileId;
  const role = await createDecisionRole({
    name: `Role-${testId}`,
    profileId: instanceProfileId,
    permissions: {
      decisions: {
        type: 'decision',
        value: {
          create: false,
          read: true,
          update: false,
          delete: false,
          admin,
          inviteMembers: false,
          review,
          submitProposals,
          vote: false,
        },
      },
    },
  });

  const member = await testData.createMemberUser({
    organization: setup.organization,
  });
  await db.insert(profileUsers).values({
    profileId: instanceProfileId,
    authUserId: member.authUserId,
    email: member.email,
  });
  await testData.assignRole(member.authUserId, instanceProfileId, role.id);

  return member;
}

const DEVELOP_RULES: ProposalRules = { develop: true, submit: false };

async function expectNotAllowed(attempt: Promise<void>) {
  const error = await attempt.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(ValidationError);
  expect(error).toHaveProperty(
    'message',
    expect.stringMatching(/^Proposals are not allowed in the .+ phase$/),
  );
}

async function expectNoPhaseAssignment(attempt: Promise<void>) {
  const error = await attempt.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(UnauthorizedError);
  expect(error).toHaveProperty(
    'message',
    expect.stringContaining('no category assignment for this phase'),
  );
}

describe.concurrent('assertProposalDevelopAccess', () => {
  it('allows a caller with Review and a row for the phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const member = await createMemberWithRole({
      testData,
      setup,
      review: true,
      submitProposals: true,
      testId: task.id,
    });
    await createCategoryReviewerWithTerm({
      processInstanceId: setup.instance.instance.id,
      reviewerProfileId: member.profileId,
      phaseId: PHASE_ID,
      onTestFinished,
    });

    await expect(
      assertProposalDevelopAccess({
        instance: withProposalRules(setup.instance, DEVELOP_RULES),
        phaseId: PHASE_ID,
        user: { id: member.authUserId },
      }),
    ).resolves.toBeUndefined();
  });

  it('allows a caller with Review and a row but no Submit bit', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const member = await createMemberWithRole({
      testData,
      setup,
      review: true,
      submitProposals: false,
      testId: task.id,
    });
    await createCategoryReviewerWithTerm({
      processInstanceId: setup.instance.instance.id,
      reviewerProfileId: member.profileId,
      phaseId: PHASE_ID,
      onTestFinished,
    });

    await expect(
      assertProposalDevelopAccess({
        instance: withProposalRules(setup.instance, DEVELOP_RULES),
        phaseId: PHASE_ID,
        user: { id: member.authUserId },
      }),
    ).resolves.toBeUndefined();
  });

  it('allows a profile admin with no row', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    await expect(
      assertProposalDevelopAccess({
        instance: withProposalRules(setup.instance, DEVELOP_RULES),
        phaseId: PHASE_ID,
        user: { id: setup.user.id },
      }),
    ).resolves.toBeUndefined();
  });

  it('allows a caller with the decisions Admin permission and no row', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const member = await createMemberWithRole({
      testData,
      setup,
      review: false,
      submitProposals: false,
      admin: true,
      testId: task.id,
    });

    await expect(
      assertProposalDevelopAccess({
        instance: withProposalRules(setup.instance, DEVELOP_RULES),
        phaseId: PHASE_ID,
        user: { id: member.authUserId },
      }),
    ).resolves.toBeUndefined();
  });

  it.for([
    { name: 'no row', rowPhaseId: undefined },
    { name: 'a row with phase NULL', rowPhaseId: null },
    { name: 'a row for another phase', rowPhaseId: 'final' },
  ])(
    'refuses a caller with Review and $name with UnauthorizedError',
    async ({ rowPhaseId }, { task, onTestFinished }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const member = await createMemberWithRole({
        testData,
        setup,
        review: true,
        submitProposals: true,
        testId: task.id,
      });
      if (rowPhaseId !== undefined) {
        await createCategoryReviewerWithTerm({
          processInstanceId: setup.instance.instance.id,
          reviewerProfileId: member.profileId,
          phaseId: rowPhaseId,
          onTestFinished,
        });
      }

      await expectNoPhaseAssignment(
        assertProposalDevelopAccess({
          instance: withProposalRules(setup.instance, DEVELOP_RULES),
          phaseId: PHASE_ID,
          user: { id: member.authUserId },
        }),
      );
    },
  );

  it('refuses a caller with Review whose row is on another instance with the same phase id', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 2,
      grantAccess: true,
    });
    const otherInstance = setup.instances[1];
    if (!otherInstance) {
      throw new Error('Second instance not created');
    }
    const member = await createMemberWithRole({
      testData,
      setup,
      review: true,
      submitProposals: true,
      testId: task.id,
    });
    await createCategoryReviewerWithTerm({
      processInstanceId: otherInstance.instance.id,
      reviewerProfileId: member.profileId,
      phaseId: PHASE_ID,
      onTestFinished,
    });

    await expectNoPhaseAssignment(
      assertProposalDevelopAccess({
        instance: withProposalRules(setup.instance, DEVELOP_RULES),
        phaseId: PHASE_ID,
        user: { id: member.authUserId },
      }),
    );
  });

  it('refuses a participant without Review with ValidationError', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const participant = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });

    await expectNotAllowed(
      assertProposalDevelopAccess({
        instance: withProposalRules(setup.instance, DEVELOP_RULES),
        phaseId: PHASE_ID,
        user: { id: participant.authUserId },
      }),
    );
  });

  it('refuses an admin of the owning organization with no role on the instance profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const orgAdmin = await testData.createMemberUser({
      organization: setup.organization,
      orgRoleId: ROLES.ADMIN.id,
    });

    await expectNotAllowed(
      assertProposalDevelopAccess({
        instance: withProposalRules(setup.instance, DEVELOP_RULES),
        phaseId: PHASE_ID,
        user: { id: orgAdmin.authUserId },
      }),
    );
  });

  it('refuses on an instance without a decision profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    await expectNotAllowed(
      assertProposalDevelopAccess({
        instance: {
          ...withProposalRules(setup.instance, DEVELOP_RULES),
          profileId: null,
        },
        phaseId: PHASE_ID,
        user: { id: setup.user.id },
      }),
    );
  });
});
