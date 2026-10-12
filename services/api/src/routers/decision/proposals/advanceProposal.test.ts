import {
  type DecisionSchemaDefinition,
  getProposalIdsForPhase,
} from '@op/common';
import { RejectionReason } from '@op/common/client';
import { TestDecisionsDataManager } from '@op/common/testing';
import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  proposalReviewAssignments,
  users,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
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

/**
 * submission → review → results. Submission keeps one proposal, so a second
 * one is left behind in it; review passes everything through to results.
 */
const reviewSchema = {
  id: 'advance-proposal-schema',
  version: '1.0.0',
  name: 'Advance Proposal Schema',
  config: { reviewsPolicy: 'full_coverage' as const },
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      rules: { proposals: { submit: true } },
      selectionPipeline: {
        version: '1.0.0',
        blocks: [{ id: 'limit-block', type: 'limit', count: 1 }],
      },
    },
    {
      id: 'review',
      name: 'Review',
      rules: { proposals: { review: true } },
      selectionPipeline: { version: '1.0.0', blocks: [] },
    },
    { id: 'results', name: 'Results', rules: {} },
  ],
} satisfies DecisionSchemaDefinition;

/** Same phases, but no submission pipeline: the review phase awaits a manual selection. */
const pendingSelectionSchema = {
  ...reviewSchema,
  phases: [
    { id: 'submission', name: 'Submission', rules: {} },
    ...reviewSchema.phases.slice(1),
  ],
} satisfies DecisionSchemaDefinition;

/**
 * A published instance with two submitted proposals by a non-reviewing member
 * (so the admin creator is an eligible reviewer for both).
 */
async function seedInstance(
  testData: TestDecisionsDataManager,
  processSchema:
    | typeof reviewSchema
    | typeof pendingSelectionSchema = reviewSchema,
) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
    processSchema,
    status: ProcessStatus.PUBLISHED,
  });
  const instanceId = setup.instance.instance.id;

  const author = await testData.createMemberUser({
    organization: setup.organization,
    instanceProfileIds: [setup.instance.profileId],
  });

  const [first, second, caller, [creator]] = await Promise.all([
    testData.createProposal({
      userEmail: author.email,
      processInstanceId: instanceId,
      proposalData: { title: 'First proposal' },
      status: ProposalStatus.SUBMITTED,
    }),
    testData.createProposal({
      userEmail: author.email,
      processInstanceId: instanceId,
      proposalData: { title: 'Second proposal' },
      status: ProposalStatus.SUBMITTED,
    }),
    createAuthenticatedCaller(setup.userEmail),
    db
      .select({ profileId: users.profileId })
      .from(users)
      .where(eq(users.authUserId, setup.user.id)),
  ]);

  return {
    setup,
    instanceId,
    author,
    caller,
    creatorProfileId: creator?.profileId,
    proposalIds: [first.id, second.id],
  };
}

async function getReviewPhaseIds(instanceId: string) {
  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
    columns: { id: true, instanceData: true, currentStateId: true },
  });
  if (!instance) {
    throw new Error('Expected instance to exist');
  }
  return getProposalIdsForPhase({ instance, phaseId: 'review' });
}

/** Advances into review and returns the proposal the pipeline left behind. */
async function advanceLeavingOneBehind(
  testData: TestDecisionsDataManager,
  instanceId: string,
  proposalIds: string[],
) {
  await testData.advancePhase({
    instanceId,
    fromPhaseId: 'submission',
    toPhaseId: 'review',
  });
  const inReview = await getReviewPhaseIds(instanceId);
  const advanced = proposalIds.find((id) => inReview.includes(id));
  const leftBehind = proposalIds.find((id) => !inReview.includes(id));
  if (!advanced || !leftBehind) {
    throw new Error('Expected the pipeline to keep exactly one proposal');
  }
  return { advanced, leftBehind };
}

describe.concurrent('advanceProposal', () => {
  it('offers the current phase only for a proposal outside it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, caller, proposalIds } = await seedInstance(testData);
    const { advanced, leftBehind } = await advanceLeavingOneBehind(
      testData,
      instanceId,
      proposalIds,
    );

    await expect(
      caller.decision.getProposalAdvanceTarget({ proposalId: leftBehind }),
    ).resolves.toEqual({ phaseId: 'review', phaseName: 'Review' });
    await expect(
      caller.decision.getProposalAdvanceTarget({ proposalId: advanced }),
    ).resolves.toBeNull();
  });

  it('moves the proposal into the current phase and assigns its reviews', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, caller, proposalIds, creatorProfileId } =
      await seedInstance(testData);
    const { leftBehind } = await advanceLeavingOneBehind(
      testData,
      instanceId,
      proposalIds,
    );

    await caller.decision.advanceProposal({
      proposalId: leftBehind,
      phaseId: 'review',
    });

    expect(await getReviewPhaseIds(instanceId)).toEqual(
      expect.arrayContaining(proposalIds),
    );

    const assignments = await db
      .select({
        reviewerProfileId: proposalReviewAssignments.reviewerProfileId,
        phaseId: proposalReviewAssignments.phaseId,
      })
      .from(proposalReviewAssignments)
      .where(eq(proposalReviewAssignments.proposalId, leftBehind));
    expect(assignments).toContainEqual({
      reviewerProfileId: creatorProfileId,
      phaseId: 'review',
    });

    await expect(
      caller.decision.getProposalAdvanceTarget({ proposalId: leftBehind }),
    ).resolves.toBeNull();
    await expect(
      caller.decision.advanceProposal({
        proposalId: leftBehind,
        phaseId: 'review',
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('refuses when the decision is no longer in the offered phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, caller, proposalIds } = await seedInstance(testData);
    const { leftBehind } = await advanceLeavingOneBehind(
      testData,
      instanceId,
      proposalIds,
    );

    await expect(
      caller.decision.advanceProposal({
        proposalId: leftBehind,
        phaseId: 'submission',
      }),
    ).rejects.toMatchObject({ cause: { name: 'ConflictError' } });
  });

  it('offers nothing in the first phase', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { caller, proposalIds } = await seedInstance(testData);
    const [proposalId] = proposalIds;
    if (!proposalId) {
      throw new Error('Expected a proposal');
    }

    await expect(
      caller.decision.getProposalAdvanceTarget({ proposalId }),
    ).resolves.toBeNull();
    await expect(
      caller.decision.advanceProposal({ proposalId, phaseId: 'submission' }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('offers nothing in the final phase', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, caller, proposalIds } = await seedInstance(testData);
    const { leftBehind } = await advanceLeavingOneBehind(
      testData,
      instanceId,
      proposalIds,
    );
    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'review',
      toPhaseId: 'results',
    });

    await expect(
      caller.decision.getProposalAdvanceTarget({ proposalId: leftBehind }),
    ).resolves.toBeNull();
  });

  it('offers nothing while the phase awaits its manual selection', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, caller, proposalIds } = await seedInstance(
      testData,
      pendingSelectionSchema,
    );
    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });
    const [proposalId] = proposalIds;
    if (!proposalId) {
      throw new Error('Expected a proposal');
    }

    await expect(
      caller.decision.getProposalAdvanceTarget({ proposalId }),
    ).resolves.toBeNull();
    await expect(
      caller.decision.advanceProposal({ proposalId, phaseId: 'review' }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('offers nothing for a rejected proposal', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, caller, proposalIds } = await seedInstance(testData);
    const { leftBehind } = await advanceLeavingOneBehind(
      testData,
      instanceId,
      proposalIds,
    );
    await caller.decision.rejectProposal({
      proposalId: leftBehind,
      reason: RejectionReason.INELIGIBLE,
    });

    await expect(
      caller.decision.getProposalAdvanceTarget({ proposalId: leftBehind }),
    ).resolves.toBeNull();
  });

  it('refuses a member without decision-admin access', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, author, proposalIds } = await seedInstance(testData);
    const { leftBehind } = await advanceLeavingOneBehind(
      testData,
      instanceId,
      proposalIds,
    );
    const memberCaller = await createAuthenticatedCaller(author.email);

    await expect(
      memberCaller.decision.getProposalAdvanceTarget({
        proposalId: leftBehind,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
    await expect(
      memberCaller.decision.advanceProposal({
        proposalId: leftBehind,
        phaseId: 'review',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});

const UNKNOWN_PROPOSAL_ID = '00000000-0000-0000-0000-000000000000';

describeDecisionAccessTierGating('decision.advanceProposal', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller',
    async ({ callers }) => {
      const caller = await callers.noJwt();
      await expectFailsAccessTierGate(
        caller.decision.advanceProposal({
          proposalId: UNKNOWN_PROPOSAL_ID,
          phaseId: 'review',
        }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.decision.advanceProposal({
          proposalId: UNKNOWN_PROPOSAL_ID,
          phaseId: 'review',
        }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'rejects out-of-network user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectFailsAccessTierGate(
        caller.decision.advanceProposal({
          proposalId: UNKNOWN_PROPOSAL_ID,
          phaseId: 'review',
        }),
        'user',
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.decision.advanceProposal({
          proposalId: UNKNOWN_PROPOSAL_ID,
          phaseId: 'review',
        }),
      );
    },
  ),
});

describeDecisionAccessTierGating('decision.getProposalAdvanceTarget', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller',
    async ({ callers }) => {
      const caller = await callers.noJwt();
      await expectFailsAccessTierGate(
        caller.decision.getProposalAdvanceTarget({
          proposalId: UNKNOWN_PROPOSAL_ID,
        }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.decision.getProposalAdvanceTarget({
          proposalId: UNKNOWN_PROPOSAL_ID,
        }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'rejects out-of-network user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectFailsAccessTierGate(
        caller.decision.getProposalAdvanceTarget({
          proposalId: UNKNOWN_PROPOSAL_ID,
        }),
        'user',
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.decision.getProposalAdvanceTarget({
          proposalId: UNKNOWN_PROPOSAL_ID,
        }),
      );
    },
  ),
});
