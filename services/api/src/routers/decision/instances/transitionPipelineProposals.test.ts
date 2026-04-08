import { TransitionEngine, getProposalsForPhase } from '@op/common';
import { db, eq } from '@op/db/client';
import {
  decisionTransitionProposals,
  stateTransitionHistory,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  createAndSubmitProposal,
  createInstanceWithSchema,
  schemaWithPipeline,
  schemaWithThreePhasesAndPipelines,
  schemaWithoutPipeline,
} from '../../../test/helpers/pipelineTestFixtures';

describe.concurrent('Transition pipeline: join table population', () => {
  it('creates exactly 2 join rows when selectionPipeline limits to 2 from 3 proposals', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const { instanceId, user, userEmail, caller } =
      await createInstanceWithSchema(testData, task.id, schemaWithPipeline);

    // Create and submit 3 proposals (submitted proposals are eligible for transition)
    for (let i = 1; i <= 3; i++) {
      await createAndSubmitProposal(testData, caller, {
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal ${i} ${task.id}` },
      });
    }

    await TransitionEngine.executeTransition({
      data: { instanceId, toStateId: 'review' },
      user,
    });

    // Find the stateTransitionHistory row
    const [transition] = await db
      .select()
      .from(stateTransitionHistory)
      .where(eq(stateTransitionHistory.processInstanceId, instanceId))
      .limit(1);

    expect(transition).toBeDefined();

    const joinRows = await db
      .select()
      .from(decisionTransitionProposals)
      .where(
        eq(decisionTransitionProposals.transitionHistoryId, transition!.id),
      );

    expect(joinRows).toHaveLength(2);
  });

  it('proposal scoping chains correctly across two transitions', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const { instanceId, user, userEmail, caller } =
      await createInstanceWithSchema(
        testData,
        task.id,
        schemaWithThreePhasesAndPipelines,
      );

    // Submit 4 proposals; first pipeline limits to 3, second limits to 2
    for (let i = 1; i <= 4; i++) {
      await createAndSubmitProposal(testData, caller, {
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal ${i} ${task.id}` },
      });
    }

    // First transition: submission → review (limit 3)
    await TransitionEngine.executeTransition({
      data: { instanceId, toStateId: 'review' },
      user,
    });

    // Second transition: review → final (limit 2, from the 3 that survived)
    await TransitionEngine.executeTransition({
      data: { instanceId, toStateId: 'final' },
      user,
    });

    // Historical access: proposals that survived into review = 3
    const reviewPhaseProposals = await getProposalsForPhase({
      instanceId,
      phaseId: 'review',
    });
    expect(reviewPhaseProposals).toHaveLength(3);

    // Historical access: proposals that survived into final = 2
    const finalPhaseProposals = await getProposalsForPhase({
      instanceId,
      phaseId: 'final',
    });
    expect(finalPhaseProposals).toHaveLength(2);

    // Current phase (no phaseId) = same as final = 2
    const currentPhaseProposals = await getProposalsForPhase({ instanceId });
    expect(currentPhaseProposals).toHaveLength(2);

    // The 2 final proposals must be a subset of the 3 review proposals
    const reviewIds = new Set(reviewPhaseProposals.map((p) => p.id));
    for (const p of finalPhaseProposals) {
      expect(reviewIds.has(p.id)).toBe(true);
    }
  });

  it('creates join rows for ALL proposals when no selectionPipeline is defined', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const { instanceId, user, userEmail, caller } =
      await createInstanceWithSchema(testData, task.id, schemaWithoutPipeline);

    // Create and submit 3 proposals (submitted proposals are eligible for transition)
    for (let i = 1; i <= 3; i++) {
      await createAndSubmitProposal(testData, caller, {
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal ${i} ${task.id}` },
      });
    }

    await TransitionEngine.executeTransition({
      data: { instanceId, toStateId: 'review' },
      user,
    });

    const [transition] = await db
      .select()
      .from(stateTransitionHistory)
      .where(eq(stateTransitionHistory.processInstanceId, instanceId))
      .limit(1);

    expect(transition).toBeDefined();

    const joinRows = await db
      .select()
      .from(decisionTransitionProposals)
      .where(
        eq(decisionTransitionProposals.transitionHistoryId, transition!.id),
      );

    expect(joinRows).toHaveLength(3);
  });

  it('returns empty when pipeline eliminates every proposal (no legacy fallback for new instances)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Schema with limit(0) — eliminates everything
    const schemaWithZeroLimit = {
      ...schemaWithPipeline,
      phases: [
        {
          id: 'submission',
          name: 'Submission',
          rules: {},
          selectionPipeline: {
            version: '1.0.0',
            blocks: [{ id: 'limit-zero', type: 'limit', count: 0 }],
          },
        },
        { id: 'review', name: 'Review', rules: {} },
      ],
    };

    const { instanceId, user, userEmail, caller } =
      await createInstanceWithSchema(testData, task.id, schemaWithZeroLimit);

    await createAndSubmitProposal(testData, caller, {
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Doomed ${task.id}` },
    });

    // Transition succeeds but pipeline eliminates all proposals.
    // The transition row exists, so this is unambiguously "new system, zero survivors"
    // (not legacy data) — getProposalsForPhase must return [].
    await TransitionEngine.executeTransition({
      data: { instanceId, toStateId: 'review' },
      user,
    });

    const result = await getProposalsForPhase({ instanceId });
    expect(result).toHaveLength(0);
  });
});
