import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
  ProposalReviewAssignmentStatus,
  ProposalStatus,
  decisionsVoteProposals,
  decisionsVoteSubmissions,
  proposalReviewAssignments,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

const gatingInput = { instanceId: crypto.randomUUID() };

describeAccessTierGating('platform.admin.revertDecisionPhase', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.platform.admin.revertDecisionPhase(gatingInput),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.platform.admin.revertDecisionPhase(gatingInput),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'rejects user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expect(
        caller.platform.admin.revertDecisionPhase(gatingInput),
      ).rejects.toMatchObject({
        cause: { name: 'UnauthorizedError' },
      });
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.platform.admin.revertDecisionPhase(gatingInput),
      );
    },
  ),
});

describe.concurrent('platform.admin.revertDecisionPhase', () => {
  /**
   * A published instance on the default two-phase schema (initial → final)
   * with one submitted proposal. The `initial` phase carries an empty-blocks
   * selection pipeline, so advancing attaches the proposal to the transition.
   */
  const createAdvancedInstance = async (
    taskId: string,
    onTestFinished: ConstructorParameters<typeof TestDecisionsDataManager>[1],
  ) => {
    const testData = new TestDecisionsDataManager(taskId, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instance.instance.id;

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Proposal ${taskId}` },
      status: ProposalStatus.SUBMITTED,
    });

    const { session } = await createIsolatedSession(setup.userEmail);
    const caller = createCaller(await createTestContextWithSession(session));

    await caller.decision.transitionFromPhase({ instanceId });

    return { setup, testData, instanceId, proposal, caller };
  };

  it('moves the instance back and deletes the transition it undoes', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, proposal, caller } = await createAdvancedInstance(
      task.id,
      onTestFinished,
    );

    const attachedBefore = await db.query.decisionTransitionProposals.findMany({
      where: { processInstanceId: instanceId },
    });
    expect(attachedBefore.map((row) => row.proposalId)).toContain(proposal.id);

    const result = await caller.platform.admin.revertDecisionPhase({
      instanceId,
      fromPhaseId: 'final',
    });

    expect(result).toEqual({
      currentPhaseId: 'initial',
      revertedPhaseId: 'final',
    });

    const instance = await db.query.processInstances.findFirst({
      where: { id: instanceId },
    });
    expect(instance!.currentStateId).toBe('initial');

    const history = await db.query.stateTransitionHistory.findMany({
      where: { processInstanceId: instanceId },
    });
    expect(history).toHaveLength(0);

    // Cascades off the deleted history row: the proposal stops belonging to
    // the phase the advance carried it into.
    const attachedAfter = await db.query.decisionTransitionProposals.findMany({
      where: { processInstanceId: instanceId },
    });
    expect(attachedAfter).toHaveLength(0);
  });

  it('keeps the results the final-phase advance recorded', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, caller } = await createAdvancedInstance(
      task.id,
      onTestFinished,
    );

    const resultsBefore = await db.query.decisionProcessResults.findMany({
      where: { processInstanceId: instanceId },
    });
    expect(resultsBefore.length).toBeGreaterThan(0);

    await caller.platform.admin.revertDecisionPhase({ instanceId });

    // The rows survive as the audit trail that a result once occurred...
    const resultsAfter = await db.query.decisionProcessResults.findMany({
      where: { processInstanceId: instanceId },
    });
    expect(resultsAfter.map((row) => row.id).sort()).toEqual(
      resultsBefore.map((row) => row.id).sort(),
    );

    // ...but every one of them is stamped, so no reader treats them as the
    // instance's live published result.
    expect(resultsAfter.every((row) => row.revertedAt !== null)).toBe(true);
  });

  it('keeps votes cast before the reversal', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, proposal, setup, caller } =
      await createAdvancedInstance(task.id, onTestFinished);

    const [submission] = await db
      .insert(decisionsVoteSubmissions)
      .values({
        processInstanceId: instanceId,
        submittedByProfileId: setup.instance.profileId,
        voteData: {
          schemaVersion: '1.0.0',
          schemaType: 'test',
          submissionMetadata: { timestamp: new Date().toISOString() },
          validationSignature: `test-${task.id}`,
        },
      })
      .returning({ id: decisionsVoteSubmissions.id });

    await db.insert(decisionsVoteProposals).values({
      voteSubmissionId: submission!.id,
      proposalId: proposal.id,
    });

    await caller.platform.admin.revertDecisionPhase({ instanceId });

    const submissions = await db
      .select({ id: decisionsVoteSubmissions.id })
      .from(decisionsVoteSubmissions)
      .where(eq(decisionsVoteSubmissions.processInstanceId, instanceId));
    expect(submissions.map((row) => row.id)).toEqual([submission!.id]);

    const ballots = await db
      .select({ proposalId: decisionsVoteProposals.proposalId })
      .from(decisionsVoteProposals)
      .where(eq(decisionsVoteProposals.voteSubmissionId, submission!.id));
    expect(ballots.map((row) => row.proposalId)).toEqual([proposal.id]);
  });

  it('stops republishing vote tallies once the results phase is reverted', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, proposal, setup, testData, caller } =
      await createAdvancedInstance(task.id, onTestFinished);

    const voter = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });

    const [submission] = await db
      .insert(decisionsVoteSubmissions)
      .values({
        processInstanceId: instanceId,
        submittedByProfileId: voter.profileId,
        voteData: {
          schemaVersion: '1.0.0',
          schemaType: 'test',
          submissionMetadata: { timestamp: new Date().toISOString() },
          validationSignature: `test-${task.id}`,
        },
      })
      .returning({ id: decisionsVoteSubmissions.id });

    await db.insert(decisionsVoteProposals).values({
      voteSubmissionId: submission!.id,
      proposalId: proposal.id,
    });

    const { session } = await createIsolatedSession(voter.email);
    const voterCaller = createCaller(
      await createTestContextWithSession(session),
    );
    const readBallot = async () => {
      const { proposals: rows } = await voterCaller.decision.listProposals({
        processInstanceId: instanceId,
        votedByProfileId: voter.profileId,
      });
      return rows.find((row) => row.id === proposal.id)?.voteCount;
    };

    // The advance published a results record, so tallies are visible.
    expect(await readBallot()).toBe(1);

    await caller.platform.admin.revertDecisionPhase({ instanceId });

    // Reverting re-opens the process, so the tally must go back to being
    // withheld rather than leaking a live count into the re-opened phase.
    expect(await readBallot()).toBeNull();
  });

  it('deletes review assignments that no reviewer has started', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, proposal, setup, caller } =
      await createAdvancedInstance(task.id, onTestFinished);

    await db.insert(proposalReviewAssignments).values({
      processInstanceId: instanceId,
      proposalId: proposal.id,
      reviewerProfileId: setup.instance.profileId,
      phaseId: 'final',
      status: ProposalReviewAssignmentStatus.PENDING,
    });

    await caller.platform.admin.revertDecisionPhase({ instanceId });

    const assignments = await db
      .select({ id: proposalReviewAssignments.id })
      .from(proposalReviewAssignments)
      .where(eq(proposalReviewAssignments.processInstanceId, instanceId));
    expect(assignments).toHaveLength(0);
  });

  it('refuses to revert once a reviewer has started an assignment', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, proposal, setup, caller } =
      await createAdvancedInstance(task.id, onTestFinished);

    await db.insert(proposalReviewAssignments).values({
      processInstanceId: instanceId,
      proposalId: proposal.id,
      reviewerProfileId: setup.instance.profileId,
      phaseId: 'final',
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });

    await expect(
      caller.platform.admin.revertDecisionPhase({ instanceId }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });

    // Nothing was undone.
    const instance = await db.query.processInstances.findFirst({
      where: { id: instanceId },
    });
    expect(instance!.currentStateId).toBe('final');

    const history = await db.query.stateTransitionHistory.findMany({
      where: { processInstanceId: instanceId },
    });
    expect(history).toHaveLength(1);
  });

  it('rejects a fromPhaseId the instance is no longer on', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, caller } = await createAdvancedInstance(
      task.id,
      onTestFinished,
    );

    await expect(
      caller.platform.admin.revertDecisionPhase({
        instanceId,
        fromPhaseId: 'initial',
      }),
    ).rejects.toMatchObject({ cause: { name: 'ConflictError' } });
  });

  it('rejects an instance that has never advanced', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
    });

    const { session } = await createIsolatedSession(setup.userEmail);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.platform.admin.revertDecisionPhase({
        instanceId: setup.instance.instance.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('rejects an instance that is not published', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.DRAFT,
    });

    const { session } = await createIsolatedSession(setup.userEmail);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.platform.admin.revertDecisionPhase({
        instanceId: setup.instance.instance.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });
});
