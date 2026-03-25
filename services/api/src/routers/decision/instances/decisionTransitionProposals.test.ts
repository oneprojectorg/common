import { db } from '@op/db/client';
import {
  decisionTransitionProposals,
  proposals,
  proposalHistory,
  stateTransitionHistory,
} from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';

async function triggerProposalHistory(proposalId: string) {
  await db
    .update(proposals)
    .set({ proposalData: { title: 'Updated to trigger history' } })
    .where(eq(proposals.id, proposalId));

  const [historyRecord] = await db
    .select({ historyId: proposalHistory.historyId })
    .from(proposalHistory)
    .where(eq(proposalHistory.id, proposalId));

  if (!historyRecord) {
    throw new Error('Proposal history record was not created by trigger');
  }

  return historyRecord;
}

describe.concurrent('decisionTransitionProposals constraints', () => {
  it('should reject linking a transition from one process to a proposal from another', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const [setupA, setupB] = await Promise.all([
      testData.createDecisionSetup({
        processName: 'Process A',
        instanceCount: 1,
      }),
      testData.createDecisionSetup({
        processName: 'Process B',
        instanceCount: 1,
      }),
    ]);

    const instanceA = setupA.instances[0]!;
    const instanceB = setupB.instances[0]!;

    const proposal = await testData.createProposal({
      callerEmail: setupB.userEmail,
      processInstanceId: instanceB.instance.id,
      proposalData: { title: 'Proposal in process B' },
    });

    const historyRecord = await triggerProposalHistory(proposal.id);

    const [transitionA] = await db
      .insert(stateTransitionHistory)
      .values({
        processInstanceId: instanceA.instance.id,
        toStateId: 'review',
      })
      .returning();

    await expect(
      db.insert(decisionTransitionProposals).values({
        processInstanceId: instanceA.instance.id,
        transitionHistoryId: transitionA!.id,
        proposalId: proposal.id,
        proposalHistoryId: historyRecord.historyId,
      }),
    ).rejects.toThrow();
  });

  it('should allow linking a transition to a proposal within the same process', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      processName: 'Same Process',
      instanceCount: 1,
    });

    const instance = setup.instances[0]!;

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Proposal in same process' },
    });

    const historyRecord = await triggerProposalHistory(proposal.id);

    const [transition] = await db
      .insert(stateTransitionHistory)
      .values({
        processInstanceId: instance.instance.id,
        toStateId: 'review',
      })
      .returning();

    const [inserted] = await db
      .insert(decisionTransitionProposals)
      .values({
        processInstanceId: instance.instance.id,
        transitionHistoryId: transition!.id,
        proposalId: proposal.id,
        proposalHistoryId: historyRecord.historyId,
      })
      .returning();

    expect(inserted).toBeDefined();
  });
});
