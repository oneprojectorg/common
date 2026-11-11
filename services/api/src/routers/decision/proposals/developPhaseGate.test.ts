import { type DecisionInstanceData, createDecisionRole } from '@op/common';
import {
  TestDecisionsDataManager,
  createCategoryReviewer,
} from '@op/common/testing';
import {
  ProposalStatus,
  Visibility,
  processInstances,
  taxonomyTerms,
} from '@op/db/schema';
import { db, eq } from '@op/db/test';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

const CURRENT_PHASE_ID = 'initial';

const NOT_ALLOWED = {
  cause: {
    name: 'ValidationError',
    message: expect.stringMatching(
      /^Proposals are not allowed in the .+ phase$/,
    ),
  },
};

type ProposalRules = NonNullable<
  NonNullable<DecisionInstanceData['phases'][number]['rules']>['proposals']
>;

type CallerScope =
  | { mapping: 'none' }
  | { mapping: 'phase'; phaseId: string | null };

type OnTestFinished = (fn: () => void | Promise<void>) => void;

type Setup = Awaited<
  ReturnType<TestDecisionsDataManager['createDecisionSetup']>
>;

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

/** Replaces the current phase's proposal rules. */
async function setProposalRules(instanceId: string, proposals: ProposalRules) {
  const record = await db.query.processInstances.findFirst({
    where: { id: instanceId },
  });
  if (!record) {
    throw new Error('Instance not found');
  }
  const instanceData = record.instanceData as DecisionInstanceData;
  const phases = instanceData.phases.map((phase) =>
    phase.phaseId === CURRENT_PHASE_ID
      ? { ...phase, rules: { ...phase.rules, proposals } }
      : phase,
  );
  await db
    .update(processInstances)
    .set({ instanceData: { ...instanceData, phases } })
    .where(eq(processInstances.id, instanceId));
}

/**
 * A member of the decision with the Submit Proposals bit, optionally the
 * Review bit, and optionally a category-reviewer row for the given phase.
 */
async function createParticipant({
  testData,
  setup,
  review,
  scope,
  testId,
  onTestFinished,
}: {
  testData: TestDecisionsDataManager;
  setup: Setup;
  review: boolean;
  scope: CallerScope;
  testId: string;
  onTestFinished: OnTestFinished;
}) {
  const instanceProfileId = setup.instance.profileId;
  const role = await createDecisionRole({
    name: `${review ? 'Facilitator' : 'Participant'}-${testId}`,
    profileId: instanceProfileId,
    permissions: {
      decisions: {
        type: 'decision',
        value: {
          create: false,
          read: true,
          update: false,
          delete: false,
          admin: false,
          inviteMembers: false,
          review,
          submitProposals: true,
          vote: false,
        },
      },
    },
  });

  const member = await testData.createMemberUser({
    organization: setup.organization,
    instanceProfileIds: [instanceProfileId],
    roleIds: { [instanceProfileId]: role.id },
  });

  if (scope.mapping === 'phase') {
    const termId = randomUUID();
    await db.insert(taxonomyTerms).values({
      id: termId,
      termUri: `district-${termId}`,
      label: `District ${testId}`,
    });
    // Deleting the term cascades to the category-reviewer row.
    onTestFinished(async () => {
      await db.delete(taxonomyTerms).where(eq(taxonomyTerms.id, termId));
    });
    await createCategoryReviewer({
      processInstanceId: setup.instance.instance.id,
      taxonomyTermId: termId,
      reviewerProfileId: member.profileId,
      phaseId: scope.phaseId,
    });
  }

  return member;
}

const DEVELOP_RULES: ProposalRules = { develop: true, submit: false };

const refusedCases: Array<{
  name: string;
  rules: ProposalRules;
  review: boolean;
  scope: CallerScope;
}> = [
  {
    name: 'a reviewer with no category-reviewer row',
    rules: DEVELOP_RULES,
    review: true,
    scope: { mapping: 'none' },
  },
  {
    name: 'a reviewer whose row is instance-wide (phase NULL)',
    rules: DEVELOP_RULES,
    review: true,
    scope: { mapping: 'phase', phaseId: null },
  },
  {
    name: 'a reviewer whose row is for another phase',
    rules: DEVELOP_RULES,
    review: true,
    scope: { mapping: 'phase', phaseId: 'final' },
  },
  {
    name: 'a participant with the Submit bit and a phase row but no Review',
    rules: DEVELOP_RULES,
    review: false,
    scope: { mapping: 'phase', phaseId: CURRENT_PHASE_ID },
  },
  {
    name: 'a participant without Review when the submit rule is unset',
    rules: { develop: true },
    review: false,
    scope: { mapping: 'none' },
  },
];

describe.concurrent('createProposal in a develop phase', () => {
  it('allows a reviewer mapped to the current phase and applies the hidden default', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;
    await setProposalRules(instanceId, {
      ...DEVELOP_RULES,
      defaults: { hidden: true },
    });
    const facilitator = await createParticipant({
      testData,
      setup,
      review: true,
      scope: { mapping: 'phase', phaseId: CURRENT_PHASE_ID },
      testId: task.id,
      onTestFinished,
    });
    const caller = await createAuthenticatedCaller(facilitator.email);

    const proposal = await caller.decision.createProposal({
      processInstanceId: instanceId,
      proposalData: { title: 'Ballot entry' },
    });
    testData.trackProfileForCleanup(proposal.profileId);

    expect(proposal.status).toBe(ProposalStatus.DRAFT);
    expect(proposal.visibility).toBe(Visibility.HIDDEN);
  });

  it.for(refusedCases)(
    'refuses $name',
    async ({ rules, review, scope }, { task, onTestFinished }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instanceId = setup.instance.instance.id;
      await setProposalRules(instanceId, rules);
      const participant = await createParticipant({
        testData,
        setup,
        review,
        scope,
        testId: task.id,
        onTestFinished,
      });
      const caller = await createAuthenticatedCaller(participant.email);

      await expect(
        caller.decision.createProposal({
          processInstanceId: instanceId,
          proposalData: { title: 'Should be refused' },
        }),
      ).rejects.toMatchObject(NOT_ALLOWED);
    },
  );
});

describe.concurrent('createProposal outside a develop phase', () => {
  it('allows a participant when the submit rule is unset', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;
    await setProposalRules(instanceId, {});
    const participant = await createParticipant({
      testData,
      setup,
      review: false,
      scope: { mapping: 'none' },
      testId: task.id,
      onTestFinished,
    });
    const caller = await createAuthenticatedCaller(participant.email);

    const proposal = await caller.decision.createProposal({
      processInstanceId: instanceId,
      proposalData: { title: 'Open submission' },
    });
    testData.trackProfileForCleanup(proposal.profileId);

    expect(proposal.status).toBe(ProposalStatus.DRAFT);
  });

  it('refuses a mapped reviewer when submit is false', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;
    await setProposalRules(instanceId, { submit: false });
    const facilitator = await createParticipant({
      testData,
      setup,
      review: true,
      scope: { mapping: 'phase', phaseId: CURRENT_PHASE_ID },
      testId: task.id,
      onTestFinished,
    });
    const caller = await createAuthenticatedCaller(facilitator.email);

    await expect(
      caller.decision.createProposal({
        processInstanceId: instanceId,
        proposalData: { title: 'Should be refused' },
      }),
    ).rejects.toMatchObject(NOT_ALLOWED);
  });
});

/**
 * Creates the participant and their draft while the phase is open, then
 * applies `rules` so only the submit step meets the gate.
 */
async function createDraftThenSetRules({
  testData,
  setup,
  rules,
  review,
  scope,
  testId,
  onTestFinished,
}: {
  testData: TestDecisionsDataManager;
  setup: Setup;
  rules: ProposalRules;
  review: boolean;
  scope: CallerScope;
  testId: string;
  onTestFinished: OnTestFinished;
}) {
  const instanceId = setup.instance.instance.id;
  const participant = await createParticipant({
    testData,
    setup,
    review,
    scope,
    testId,
    onTestFinished,
  });
  const draft = await testData.createProposal({
    userEmail: participant.email,
    processInstanceId: instanceId,
    proposalData: { title: 'Draft entry' },
  });
  await setProposalRules(instanceId, rules);
  const caller = await createAuthenticatedCaller(participant.email);
  return { caller, draft };
}

describe.concurrent('submitProposal in a develop phase', () => {
  it('allows a reviewer mapped to the current phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const { caller, draft } = await createDraftThenSetRules({
      testData,
      setup,
      rules: DEVELOP_RULES,
      review: true,
      scope: { mapping: 'phase', phaseId: CURRENT_PHASE_ID },
      testId: task.id,
      onTestFinished,
    });

    const result = await caller.decision.submitProposal({
      proposalId: draft.id,
    });

    expect(result.status).toBe(ProposalStatus.SUBMITTED);
  });

  it.for(refusedCases)(
    'refuses $name',
    async ({ rules, review, scope }, { task, onTestFinished }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const { caller, draft } = await createDraftThenSetRules({
        testData,
        setup,
        rules,
        review,
        scope,
        testId: task.id,
        onTestFinished,
      });

      await expect(
        caller.decision.submitProposal({ proposalId: draft.id }),
      ).rejects.toMatchObject(NOT_ALLOWED);
    },
  );
});

describe.concurrent('submitProposal outside a develop phase', () => {
  it('allows a participant when the submit rule is unset', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const { caller, draft } = await createDraftThenSetRules({
      testData,
      setup,
      rules: {},
      review: false,
      scope: { mapping: 'none' },
      testId: task.id,
      onTestFinished,
    });

    const result = await caller.decision.submitProposal({
      proposalId: draft.id,
    });

    expect(result.status).toBe(ProposalStatus.SUBMITTED);
  });

  it('refuses a mapped reviewer when submit is false', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const { caller, draft } = await createDraftThenSetRules({
      testData,
      setup,
      rules: { submit: false },
      review: true,
      scope: { mapping: 'phase', phaseId: CURRENT_PHASE_ID },
      testId: task.id,
      onTestFinished,
    });

    await expect(
      caller.decision.submitProposal({ proposalId: draft.id }),
    ).rejects.toMatchObject(NOT_ALLOWED);
  });
});
