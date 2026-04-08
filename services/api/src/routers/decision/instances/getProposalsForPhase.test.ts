import { TransitionEngine, getProposalsForPhase } from '@op/common';
import { db, sql } from '@op/db/client';
import {
  processInstances,
  proposals,
  stateTransitionHistory,
} from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  createAndSubmitProposal,
  createInstanceWithSchema,
  schemaWithPipeline,
  schemaWithoutPipeline,
} from '../../../test/helpers/pipelineTestFixtures';

// Random UUID unlikely to match any real transition
const NONEXISTENT_PHASE_ID = '00000000-0000-0000-0000-000000000000';

describe.concurrent('getProposalsForPhase', () => {
  it('returns all submitted proposals when no transition has occurred', async ({
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
      createAndSubmitProposal(testData, caller, {
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal 1 ${task.id}` },
      }),
      createAndSubmitProposal(testData, caller, {
        userEmail,
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
    const { instanceId, user, userEmail, caller } =
      await createInstanceWithSchema(testData, task.id, schemaWithPipeline);

    // Create and submit 3 proposals; pipeline limits to 2
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

    const result = await getProposalsForPhase({ instanceId });

    expect(result).toHaveLength(2);
  });

  it('excludes soft-deleted proposals in the no-transition path', async ({
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
      createAndSubmitProposal(testData, caller, {
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Active ${task.id}` },
      }),
      createAndSubmitProposal(testData, caller, {
        userEmail,
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

  it('returns proposals scoped to a specific phaseId (historical access)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, user, userEmail, caller } =
      await createInstanceWithSchema(testData, task.id, schemaWithPipeline);

    // Create and submit 3 proposals; pipeline limits to 2
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

    // phaseId = 'review' means "proposals that survived the transition into review"
    const result = await getProposalsForPhase({
      instanceId,
      phaseId: 'review',
    });

    expect(result).toHaveLength(2);
  });

  it('returns empty array when phaseId does not match any transition', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId } = await createInstanceWithSchema(
      testData,
      task.id,
      schemaWithoutPipeline,
    );

    const result = await getProposalsForPhase({
      instanceId,
      phaseId: NONEXISTENT_PHASE_ID,
    });

    expect(result).toHaveLength(0);
  });

  it('excludes soft-deleted proposals in the post-transition path', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, user, userEmail, caller } =
      await createInstanceWithSchema(testData, task.id, schemaWithoutPipeline);

    const [p1, p2] = await Promise.all([
      createAndSubmitProposal(testData, caller, {
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Active after transition ${task.id}` },
      }),
      createAndSubmitProposal(testData, caller, {
        userEmail,
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

  it('excludes draft proposals in the no-transition path', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, userEmail, caller } = await createInstanceWithSchema(
      testData,
      task.id,
      schemaWithoutPipeline,
    );

    // Create one submitted proposal and one draft (not submitted)
    const submitted = await createAndSubmitProposal(testData, caller, {
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Submitted ${task.id}` },
    });
    await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Draft ${task.id}` },
    });

    // No transition has occurred — should only return submitted proposals
    const result = await getProposalsForPhase({ instanceId });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(submitted.id);
  });

  it('returns all active proposals for a legacy instance regardless of join table state', async ({
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
      createAndSubmitProposal(testData, caller, {
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Legacy proposal 1 ${task.id}` },
      }),
      createAndSubmitProposal(testData, caller, {
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Legacy proposal 2 ${task.id}` },
      }),
    ]);

    // Mutate instanceData to look like a legacy instance: drop currentPhaseId,
    // add currentStateId. This is the signal getProposalsForPhase keys off of.
    await db
      .update(processInstances)
      .set({
        instanceData: sql`(${processInstances.instanceData} - 'currentPhaseId') || jsonb_build_object('currentStateId', 'review')`,
      })
      .where(eq(processInstances.id, instanceId));

    // Insert a history row WITHOUT populating the join table — mirrors legacy data
    // that transitioned before join-table writes were added.
    await db.insert(stateTransitionHistory).values({
      processInstanceId: instanceId,
      toStateId: 'review',
    });

    const result = await getProposalsForPhase({ instanceId });

    // Legacy detection short-circuits join lookup → all active proposals returned.
    const ids = result.map((r) => r.id);
    expect(ids).toContain(p1.id);
    expect(ids).toContain(p2.id);
    expect(result).toHaveLength(2);
  });
});
