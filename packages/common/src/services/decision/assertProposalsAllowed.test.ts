import {
  TestDecisionsDataManager,
  createCategoryReviewer,
} from '@op/common/testing';
import { db, eq } from '@op/db/client';
import { profileUsers, taxonomyTerms } from '@op/db/schema';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { UnauthorizedError, ValidationError } from '../../utils';
import { assertProposalsAllowed } from './assertProposalsAllowed';
import { createDecisionRole } from './decisionRoles';
import type { DecisionInstanceData } from './schemas/instanceData';

const PHASE_ID = 'initial';

type ProposalRules = NonNullable<
  NonNullable<DecisionInstanceData['phases'][number]['rules']>['proposals']
>;

type OnTestFinished = (fn: () => void | Promise<void>) => void;

type Setup = Awaited<
  ReturnType<TestDecisionsDataManager['createDecisionSetup']>
>;

type CreatedInstance = Setup['instances'][number];

/** The instance as the helper reads it, with the current phase's rules replaced. */
function withProposalRules(
  created: CreatedInstance,
  proposals: ProposalRules,
): Parameters<typeof assertProposalsAllowed>[0]['instance'] {
  const { instance } = created;
  return {
    id: instance.id,
    profileId: instance.profileId,
    ownerProfileId: instance.ownerProfileId,
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

/** A category-reviewer row for the member; its term is deleted after the test. */
async function createReviewerRow({
  processInstanceId,
  reviewerProfileId,
  phaseId,
  onTestFinished,
}: {
  processInstanceId: string;
  reviewerProfileId: string;
  phaseId: string | null;
  onTestFinished: OnTestFinished;
}) {
  const termId = randomUUID();
  await db.insert(taxonomyTerms).values({
    id: termId,
    termUri: `test-term-${termId}`,
    label: `Term ${termId}`,
  });
  // Deleting the term cascades to the category-reviewer row.
  onTestFinished(async () => {
    await db.delete(taxonomyTerms).where(eq(taxonomyTerms.id, termId));
  });
  await createCategoryReviewer({
    processInstanceId,
    taxonomyTermId: termId,
    reviewerProfileId,
    phaseId,
  });
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

describe.concurrent('assertProposalsAllowed in a develop phase', () => {
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
    await createReviewerRow({
      processInstanceId: setup.instance.instance.id,
      reviewerProfileId: member.profileId,
      phaseId: PHASE_ID,
      onTestFinished,
    });

    await expect(
      assertProposalsAllowed({
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
    await createReviewerRow({
      processInstanceId: setup.instance.instance.id,
      reviewerProfileId: member.profileId,
      phaseId: PHASE_ID,
      onTestFinished,
    });

    await expect(
      assertProposalsAllowed({
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
      assertProposalsAllowed({
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
      assertProposalsAllowed({
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
        await createReviewerRow({
          processInstanceId: setup.instance.instance.id,
          reviewerProfileId: member.profileId,
          phaseId: rowPhaseId,
          onTestFinished,
        });
      }

      await expectNoPhaseAssignment(
        assertProposalsAllowed({
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
    await createReviewerRow({
      processInstanceId: otherInstance.instance.id,
      reviewerProfileId: member.profileId,
      phaseId: PHASE_ID,
      onTestFinished,
    });

    await expectNoPhaseAssignment(
      assertProposalsAllowed({
        instance: withProposalRules(setup.instance, DEVELOP_RULES),
        phaseId: PHASE_ID,
        user: { id: member.authUserId },
      }),
    );
  });

  it.for([
    { name: 'submit is missing', rules: { develop: true } },
    { name: 'submit is true', rules: { develop: true, submit: true } },
  ])(
    'refuses a participant without Review with ValidationError when $name',
    async ({ rules }, { task, onTestFinished }) => {
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
        assertProposalsAllowed({
          instance: withProposalRules(setup.instance, rules),
          phaseId: PHASE_ID,
          user: { id: participant.authUserId },
        }),
      );
    },
  );

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
      assertProposalsAllowed({
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

describe.concurrent('assertProposalsAllowed outside a develop phase', () => {
  it('allows a participant when the submit rule is missing', async ({
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

    await expect(
      assertProposalsAllowed({
        instance: withProposalRules(setup.instance, {}),
        phaseId: PHASE_ID,
        user: { id: participant.authUserId },
      }),
    ).resolves.toBeUndefined();
  });

  it('refuses a caller with Review and a row for the phase when submit is false', async ({
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
    await createReviewerRow({
      processInstanceId: setup.instance.instance.id,
      reviewerProfileId: member.profileId,
      phaseId: PHASE_ID,
      onTestFinished,
    });

    await expectNotAllowed(
      assertProposalsAllowed({
        instance: withProposalRules(setup.instance, { submit: false }),
        phaseId: PHASE_ID,
        user: { id: member.authUserId },
      }),
    );
  });
});
