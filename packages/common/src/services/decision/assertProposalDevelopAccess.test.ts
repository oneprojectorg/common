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
 * or Develop Proposals bit unless asked for).
 */
async function createMemberWithRole({
  testData,
  setup,
  review = false,
  submitProposals = false,
  developProposals = false,
  admin = false,
  testId,
}: {
  testData: TestDecisionsDataManager;
  setup: Setup;
  review?: boolean;
  submitProposals?: boolean;
  developProposals?: boolean;
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
          developProposals,
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
const SUBMIT_ONLY_RULES: ProposalRules = { develop: false, submit: true };

async function expectNotAllowed(attempt: Promise<unknown>) {
  const error = await attempt.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(ValidationError);
  expect(error).toHaveProperty(
    'message',
    expect.stringMatching(/^Proposals cannot be developed in the .+ phase$/),
  );
}

async function expectCannotDevelop(attempt: Promise<unknown>) {
  const error = await attempt.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(UnauthorizedError);
  expect(error).toHaveProperty(
    'message',
    'You cannot develop proposals in this phase',
  );
}

describe.concurrent('assertProposalDevelopAccess', () => {
  it('allows a caller with Develop Proposals and no Review or Submit bit in a develop phase', async ({
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
      developProposals: true,
      testId: task.id,
    });

    await expect(
      assertProposalDevelopAccess({
        instance: withProposalRules(setup.instance, DEVELOP_RULES),
        phaseId: PHASE_ID,
        user: { id: member.authUserId },
      }),
    ).resolves.toMatchObject({ phaseId: PHASE_ID });
  });

  it('refuses a caller with Review and a category-reviewer row for the phase but without Develop Proposals', async ({
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

    await expectCannotDevelop(
      assertProposalDevelopAccess({
        instance: withProposalRules(setup.instance, DEVELOP_RULES),
        phaseId: PHASE_ID,
        user: { id: member.authUserId },
      }),
    );
  });

  it('allows a profile admin', async ({ task, onTestFinished }) => {
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
    ).resolves.toMatchObject({ phaseId: PHASE_ID });
  });

  it('allows a caller with the decisions Admin permission and no Develop Proposals bit', async ({
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
      admin: true,
      testId: task.id,
    });

    await expect(
      assertProposalDevelopAccess({
        instance: withProposalRules(setup.instance, DEVELOP_RULES),
        phaseId: PHASE_ID,
        user: { id: member.authUserId },
      }),
    ).resolves.toMatchObject({ phaseId: PHASE_ID });
  });

  it('refuses a caller with Develop Proposals outside a develop phase with ValidationError', async ({
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
      developProposals: true,
      testId: task.id,
    });

    await expectNotAllowed(
      assertProposalDevelopAccess({
        instance: withProposalRules(setup.instance, SUBMIT_ONLY_RULES),
        phaseId: PHASE_ID,
        user: { id: member.authUserId },
      }),
    );
  });

  it('refuses a participant without Develop Proposals with UnauthorizedError', async ({
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

    await expectCannotDevelop(
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

    await expectCannotDevelop(
      assertProposalDevelopAccess({
        instance: withProposalRules(setup.instance, DEVELOP_RULES),
        phaseId: PHASE_ID,
        user: { id: orgAdmin.authUserId },
      }),
    );
  });

  it('refuses on an instance without a decision profile with UnauthorizedError', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const error = await assertProposalDevelopAccess({
      instance: {
        ...withProposalRules(setup.instance, DEVELOP_RULES),
        profileId: null,
      },
      phaseId: PHASE_ID,
      user: { id: setup.user.id },
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error).toHaveProperty('message', "You don't have access to do this");
  });
});
