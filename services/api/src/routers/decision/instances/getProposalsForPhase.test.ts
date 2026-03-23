import { TransitionEngine, getProposalsForPhase } from '@op/common';
import { db } from '@op/db/client';
import { proposals } from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  createInstanceWithSchema,
  schemaWithPipeline,
  schemaWithoutPipeline,
} from '../../../test/helpers/pipelineTestFixtures';

describe.concurrent('getProposalsForPhase', () => {
  it('returns all non-deleted proposals when no transition has occurred', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, userEmail } = await createInstanceWithSchema(
      testData,
      task.id,
      schemaWithoutPipeline,
    );

    const [p1, p2] = await Promise.all([
      testData.createProposal({
        callerEmail: userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal 1 ${task.id}` },
      }),
      testData.createProposal({
        callerEmail: userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal 2 ${task.id}` },
      }),
    ]);

    const result = await getProposalsForPhase({ instanceId });

    const ids = result.map((p) => p.id);
    expect(ids).toContain(p1.id);
    expect(ids).toContain(p2.id);
    expect(result).toHaveLength(2);
  });

  it('returns only join-scoped proposals after a transition', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, user, userEmail } = await createInstanceWithSchema(
      testData,
      task.id,
      schemaWithPipeline,
    );

    // Create 3 proposals; pipeline limits to 2
    for (let i = 1; i <= 3; i++) {
      await testData.createProposal({
        callerEmail: userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal ${i} ${task.id}` },
      });
    }

    await TransitionEngine.executeTransition({
      data: { instanceId, toStateId: 'review' },
      user,
    });

    const result = await getProposalsForPhase({ instanceId });

    expect(result).toHaveLength(2);
  });

  it('excludes soft-deleted proposals in the no-transition path', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, userEmail } = await createInstanceWithSchema(
      testData,
      task.id,
      schemaWithoutPipeline,
    );

    const [p1, p2] = await Promise.all([
      testData.createProposal({
        callerEmail: userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Active ${task.id}` },
      }),
      testData.createProposal({
        callerEmail: userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Soft-deleted ${task.id}` },
      }),
    ]);

    // Soft-delete the second proposal
    await db
      .update(proposals)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(proposals.id, p2.id));

    const result = await getProposalsForPhase({ instanceId });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(p1.id);
  });

  it('excludes soft-deleted proposals in the post-transition path', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, user, userEmail } = await createInstanceWithSchema(
      testData,
      task.id,
      schemaWithoutPipeline,
    );

    const [p1, p2] = await Promise.all([
      testData.createProposal({
        callerEmail: userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Active after transition ${task.id}` },
      }),
      testData.createProposal({
        callerEmail: userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Soft-deleted after transition ${task.id}` },
      }),
    ]);

    // Both proposals survive the transition (no pipeline)
    await TransitionEngine.executeTransition({
      data: { instanceId, toStateId: 'review' },
      user,
    });

    // Soft-delete after transition — should still be excluded from results
    await db
      .update(proposals)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(proposals.id, p2.id));

    const result = await getProposalsForPhase({ instanceId });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(p1.id);
  });
});
