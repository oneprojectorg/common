import { getProposalsForPhase } from '@op/common';
import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  decisionTransitionProposals,
  stateTransitionHistory,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { schemaWithoutPipeline } from '../../../test/helpers/pipelineSchemas';
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

async function seedInstance(
  testData: TestDecisionsDataManager,
  processSchema: typeof schemaWithoutPipeline = schemaWithoutPipeline,
) {
  const setup = await testData.createDecisionSetup({
    processSchema,
    instanceCount: 1,
    status: ProcessStatus.PUBLISHED,
  });
  const instance = setup.instances[0];
  if (!instance) {
    throw new Error('No instance created');
  }
  const caller = await createAuthenticatedCaller(setup.userEmail);
  return {
    instanceId: instance.instance.id,
    userEmail: setup.userEmail,
    caller,
  };
}

describe.concurrent('submitManualSelection', () => {
  it('stamps the existing phase transition with manual-selection audit and attaches the selected proposals', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, userEmail, caller } = await seedInstance(testData);

    const [p1, p2] = await Promise.all([
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal 1 ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal 2 ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    // Empty auto-transition into 'review' — simulate by clearing the join rows
    // the happy-path transition writes when there is no selection pipeline.
    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });
    await db
      .delete(decisionTransitionProposals)
      .where(eq(decisionTransitionProposals.processInstanceId, instanceId));

    const [existingTransition] = await db
      .select({ id: stateTransitionHistory.id })
      .from(stateTransitionHistory)
      .where(eq(stateTransitionHistory.processInstanceId, instanceId));

    if (!existingTransition) {
      throw new Error('Expected stateTransitionHistory row to exist');
    }

    const result = await caller.decision.submitManualSelection({
      processInstanceId: instanceId,
      proposalIds: [p1.id, p2.id],
    });

    // UPDATE-in-place: the transition row must be the same one already present.
    expect(result.transitionHistoryId).toBe(existingTransition.id);
    expect(new Set(result.proposalIds)).toEqual(new Set([p1.id, p2.id]));

    const [historyRow, ...extraHistoryRows] = await db
      .select()
      .from(stateTransitionHistory)
      .where(eq(stateTransitionHistory.processInstanceId, instanceId));
    expect(extraHistoryRows).toHaveLength(0);
    if (!historyRow) {
      throw new Error('Expected exactly one history row');
    }
    expect(historyRow.fromStateId).toBe('submission');
    expect(historyRow.toStateId).toBe('review');
    expect(historyRow.transitionData).toMatchObject({
      manualSelection: {
        byProfileId: expect.any(String),
        at: expect.any(String),
      },
    });

    // Join rows must point at the existing transition, one per selected proposal.
    const attached = await db
      .select()
      .from(decisionTransitionProposals)
      .where(
        eq(
          decisionTransitionProposals.transitionHistoryId,
          result.transitionHistoryId,
        ),
      );
    expect(attached).toHaveLength(2);
    expect(new Set(attached.map((r) => r.proposalId))).toEqual(
      new Set([p1.id, p2.id]),
    );
  });

  it('rejects an empty proposalIds array', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, caller } = await seedInstance(testData);

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    await expect(
      caller.decision.submitManualSelection({
        processInstanceId: instanceId,
        proposalIds: [],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects a proposal that is not in the candidate set', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, userEmail, caller } = await seedInstance(testData);

    // Submit a real proposal so a candidate exists.
    await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Real ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });
    // Simulate the empty-advance scenario so the instance is awaiting manual
    // selection (otherwise the pipeline-attached transition makes the state
    // 'not-applicable').
    await db
      .delete(decisionTransitionProposals)
      .where(eq(decisionTransitionProposals.processInstanceId, instanceId));

    // A random valid-looking UUID that is NOT a candidate.
    const bogusId = '00000000-0000-4000-8000-000000000abc';

    await expect(
      caller.decision.submitManualSelection({
        processInstanceId: instanceId,
        proposalIds: [bogusId],
      }),
    ).rejects.toMatchObject({
      cause: {
        name: 'ValidationError',
        message: expect.stringContaining('not an eligible'),
      },
    });
  });

  it('rejects callers without admin access', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, userEmail } = await seedInstance(testData);

    const proposal = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Proposal ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const outsiderSetup = await testData.createDecisionSetup({
      instanceCount: 0,
    });
    const outsiderCaller = await createAuthenticatedCaller(
      outsiderSetup.userEmail,
    );

    await expect(
      outsiderCaller.decision.submitManualSelection({
        processInstanceId: instanceId,
        proposalIds: [proposal.id],
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });

  it('rejects a second submission after the selection has been confirmed', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, userEmail, caller } = await seedInstance(testData);

    const [p1, p2] = await Promise.all([
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal 1 ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal 2 ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });
    await db
      .delete(decisionTransitionProposals)
      .where(eq(decisionTransitionProposals.processInstanceId, instanceId));

    await caller.decision.submitManualSelection({
      processInstanceId: instanceId,
      proposalIds: [p1.id],
    });

    await expect(
      caller.decision.submitManualSelection({
        processInstanceId: instanceId,
        proposalIds: [p2.id],
      }),
    ).rejects.toMatchObject({ cause: { name: 'ConflictError' } });

    // Phase still reflects the original selection.
    const phaseProposals = await getProposalsForPhase({
      instanceId,
      phaseId: 'review',
    });
    expect(phaseProposals.map((p) => p.id)).toEqual([p1.id]);
  });

  it('rejects when a newer stateTransitionHistory row exists with toStateId !== currentStateId', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, userEmail, caller } = await seedInstance(testData);

    const proposal = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Proposal ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });
    await db
      .delete(decisionTransitionProposals)
      .where(eq(decisionTransitionProposals.processInstanceId, instanceId));

    // First submission succeeds for phase 'review'.
    await caller.decision.submitManualSelection({
      processInstanceId: instanceId,
      proposalIds: [proposal.id],
    });

    // Insert a newer transition row whose toStateId doesn't match the
    // instance's currentStateId. This is NOT a real phase advance (which
    // would also move currentStateId) — it simulates the case where the
    // "latest" stateTransitionHistory row drifts away from currentStateId.
    // The service's `latestRow.toStateId === currentStateId` guard must
    // reject amendments in this shape.
    await db.insert(stateTransitionHistory).values({
      processInstanceId: instanceId,
      fromStateId: 'review',
      toStateId: 'final',
    });

    await expect(
      caller.decision.submitManualSelection({
        processInstanceId: instanceId,
        proposalIds: [proposal.id],
      }),
    ).rejects.toMatchObject({ cause: { name: 'ConflictError' } });
  });

  it('serializes two concurrent submissions with no duplicate rows', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, userEmail, caller } = await seedInstance(testData);

    const [p1, p2] = await Promise.all([
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal 1 ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal 2 ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });
    await db
      .delete(decisionTransitionProposals)
      .where(eq(decisionTransitionProposals.processInstanceId, instanceId));

    // Fire two submissions concurrently — the row lock must serialize them,
    // so exactly one succeeds and the other rejects with CONFLICT.
    const results = await Promise.allSettled([
      caller.decision.submitManualSelection({
        processInstanceId: instanceId,
        proposalIds: [p1.id],
      }),
      caller.decision.submitManualSelection({
        processInstanceId: instanceId,
        proposalIds: [p2.id],
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const [rejectedResult] = rejected;
    if (!rejectedResult || rejectedResult.status !== 'rejected') {
      throw new Error('Expected a rejected result');
    }
    expect(rejectedResult.reason).toMatchObject({
      cause: { name: 'ConflictError' },
    });

    // One transition row, one attached set — the winner's selection.
    const [historyRow, ...extraHistoryRows] = await db
      .select()
      .from(stateTransitionHistory)
      .where(eq(stateTransitionHistory.processInstanceId, instanceId));
    expect(extraHistoryRows).toHaveLength(0);
    if (!historyRow) {
      throw new Error('Expected exactly one history row');
    }

    const attached = await db
      .select({ proposalId: decisionTransitionProposals.proposalId })
      .from(decisionTransitionProposals)
      .where(
        eq(decisionTransitionProposals.transitionHistoryId, historyRow.id),
      );
    const attachedIds = attached.map((r) => r.proposalId);
    expect([[p1.id], [p2.id]]).toContainEqual(attachedIds);
  });

  it('serializes submitManualSelection against a concurrent advancePhase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    // Schema with an extra 'final' phase so advancePhase can move past 'review'.
    const schemaWithFinal = {
      ...schemaWithoutPipeline,
      phases: [
        { id: 'submission', name: 'Submission', rules: {} },
        { id: 'review', name: 'Review', rules: {} },
        { id: 'final', name: 'Final', rules: {} },
      ],
    };
    const { instanceId, userEmail, caller } = await seedInstance(
      testData,
      schemaWithFinal,
    );

    const proposal = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Proposal ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });

    // Put the instance in the "awaiting manual selection" state: the
    // inbound transition to 'review' exists but has zero attached proposals.
    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });
    await db
      .delete(decisionTransitionProposals)
      .where(eq(decisionTransitionProposals.processInstanceId, instanceId));

    // Fire both operations concurrently. Whoever acquires the
    // `SELECT processInstances ... FOR UPDATE` lock first wins:
    //   * submit wins → its proposals are attached to transition(→review),
    //     advance then runs its pipeline over that populated pool and
    //     advances to 'final' with those proposals.
    //   * advance wins → currentStateId moves to 'final' with 0 proposals;
    //     submit sees currentStateId drifted and rejects with ConflictError.
    const [submitResult, advanceResult] = await Promise.allSettled([
      caller.decision.submitManualSelection({
        processInstanceId: instanceId,
        proposalIds: [proposal.id],
      }),
      testData.advancePhase({
        instanceId,
        fromPhaseId: 'review',
        toPhaseId: 'final',
      }),
    ]);

    if (submitResult.status === 'fulfilled') {
      // Submit won the lock. Advance should also have succeeded, with
      // the manually selected proposal flowing into 'final'.
      expect(advanceResult.status).toBe('fulfilled');
      const finalProposals = await getProposalsForPhase({
        instanceId,
        phaseId: 'final',
      });
      expect(finalProposals.map((p) => p.id)).toEqual([proposal.id]);
    } else {
      // Advance won the lock. Submit must reject — either ConflictError
      // (if submit's outer snapshot predates advance and detects drift)
      // or ValidationError (if submit's outer snapshot post-dates advance
      // and the candidate pool for the new inbound transition is empty).
      // Both outcomes prevent silent divergence.
      expect(submitResult.status).toBe('rejected');
      expect(submitResult.reason).toMatchObject({
        cause: {
          name: expect.stringMatching(/^(ConflictError|ValidationError)$/),
        },
      });
      expect(advanceResult.status).toBe('fulfilled');
    }
  });
});
