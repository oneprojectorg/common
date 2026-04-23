import { db, eq } from '@op/db/client';
import { ProposalStatus, proposals } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  createInstanceWithSchema,
  executeTestTransition,
  schemaWithPipeline,
  schemaWithoutPipeline,
} from '../../../test/helpers/pipelineTestFixtures';

describe.concurrent('listProposals: phase-scoped proposal visibility', () => {
  it('returns only selected proposals after a transition with a limiting pipeline', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, userEmail, caller } = await createInstanceWithSchema(
      testData,
      task.id,
      schemaWithPipeline,
    );

    // Create and submit 3 proposals; the pipeline limits to 2
    for (let i = 1; i <= 3; i++) {
      await testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal ${i} ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      });
    }

    await executeTestTransition({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const result = await caller.decision.listProposals({
      processInstanceId: instanceId,
    });

    expect(result.proposals).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('returns all proposals after a transition without a pipeline', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, userEmail, caller } = await createInstanceWithSchema(
      testData,
      task.id,
      schemaWithoutPipeline,
    );

    for (let i = 1; i <= 3; i++) {
      await testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal ${i} ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      });
    }

    await executeTestTransition({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const result = await caller.decision.listProposals({
      processInstanceId: instanceId,
    });

    expect(result.proposals).toHaveLength(3);
    expect(result.total).toBe(3);
  });

  it('excludes soft-deleted proposals from the phase-scoped list', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, userEmail, caller } = await createInstanceWithSchema(
      testData,
      task.id,
      schemaWithoutPipeline,
    );

    const [p1, p2] = await Promise.all([
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Active proposal ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `To-be-deleted proposal ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    // Soft-delete the second proposal before transition
    await db
      .update(proposals)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(proposals.id, p2.id));

    await executeTestTransition({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const result = await caller.decision.listProposals({
      processInstanceId: instanceId,
    });

    // Only the non-deleted proposal should appear
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]?.id).toBe(p1.id);
  });

  it('excludes proposals soft-deleted after transition from the phase-scoped list', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, userEmail, caller } = await createInstanceWithSchema(
      testData,
      task.id,
      schemaWithoutPipeline,
    );

    const [p1, p2] = await Promise.all([
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Active proposal ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `To-be-deleted after transition ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    // Transition first (both proposals make it into the join table)
    await executeTestTransition({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    // Soft-delete after transition
    await db
      .update(proposals)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(proposals.id, p2.id));

    const result = await caller.decision.listProposals({
      processInstanceId: instanceId,
    });

    // Soft-deleted proposal must be excluded even though it's in the join table
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]?.id).toBe(p1.id);
  });
});
