import { TransitionEngine } from '@op/common';
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
        callerEmail: userEmail,
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
        callerEmail: userEmail,
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
});
