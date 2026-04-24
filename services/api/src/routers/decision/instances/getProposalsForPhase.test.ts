import { getProposalsForPhase } from '@op/common';
import { db, eq, sql } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  processInstances,
  proposals,
  stateTransitionHistory,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  schemaWithPipeline,
  schemaWithoutPipeline,
} from '../../../test/helpers/pipelineSchemas';

// Random UUID unlikely to match any real transition
const NONEXISTENT_PHASE_ID = '00000000-0000-0000-0000-000000000000';

describe.concurrent('getProposalsForPhase', () => {
  it('returns all submitted proposals when no transition has occurred', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;
    const { userEmail } = setup;

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
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;
    const { userEmail } = setup;

    // Create and submit 3 proposals; pipeline limits to 2
    for (let i = 1; i <= 3; i++) {
      await testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal ${i} ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      });
    }

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const result = await getProposalsForPhase({ instanceId });

    expect(result).toHaveLength(2);
  });

  it('excludes soft-deleted proposals in the no-transition path', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;
    const { userEmail } = setup;

    const [p1, p2] = await Promise.all([
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Active ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Soft-deleted ${task.id}` },
        status: ProposalStatus.SUBMITTED,
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
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;
    const { userEmail } = setup;

    // Create and submit 3 proposals; pipeline limits to 2
    for (let i = 1; i <= 3; i++) {
      await testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal ${i} ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      });
    }

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
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
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;

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
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;
    const { userEmail } = setup;

    const [p1, p2] = await Promise.all([
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Active after transition ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Soft-deleted after transition ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    // Both proposals survive the transition (no pipeline)
    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
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
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;
    const { userEmail } = setup;

    // Create one submitted proposal and one draft (not submitted)
    const submitted = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Submitted ${task.id}` },
      status: ProposalStatus.SUBMITTED,
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

  it('includes proposals submitted during the current phase (post advance-in)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;
    const { userEmail } = setup;

    const p1 = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Submission-phase proposal ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    // Submitted AFTER advancing into review — not part of the inbound snapshot.
    const p2 = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Review-phase proposal ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });

    const result = await getProposalsForPhase({ instanceId });

    const ids = result.map((p) => p.id);
    expect(ids).toContain(p1.id);
    expect(ids).toContain(p2.id);
    expect(result).toHaveLength(2);
  });

  it('attributes proposals to the phase they were created in (createdAt-based)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;
    const { userEmail } = setup;

    const submissionPhaseProposal = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Submission-phase ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const reviewPhaseProposal = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Review-phase ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });

    const submissionResult = await getProposalsForPhase({
      instanceId,
      phaseId: 'submission',
    });
    // Window for submission is (-∞, transition-into-review). Only the proposal
    // created before the advance qualifies.
    expect(submissionResult.map((p) => p.id)).toEqual([
      submissionPhaseProposal.id,
    ]);

    const reviewResult = await getProposalsForPhase({
      instanceId,
      phaseId: 'review',
    });
    // Review = attachments (both proposals attached by no-pipeline advance) ∪
    // during-window (reviewPhaseProposal). Dedup → both proposals.
    const reviewIds = reviewResult.map((p) => p.id).sort();
    expect(reviewIds).toEqual(
      [submissionPhaseProposal.id, reviewPhaseProposal.id].sort(),
    );
  });

  it('does not resurface a rejected proposal that was edited in the next phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    // Pipeline drops all but 1 proposal at submission → review.
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;
    const { userEmail } = setup;

    // Create 3 proposals in submission; pipeline will shortlist 2.
    const proposalsCreated = [] as Array<{ id: string }>;
    for (let i = 1; i <= 3; i++) {
      const p = await testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal ${i} ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      });
      proposalsCreated.push(p);
    }

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    // Identify the 2 that survived and the 1 that did not.
    const survivors = await getProposalsForPhase({
      instanceId,
      phaseId: 'review',
    });
    const survivorIds = new Set(survivors.map((p) => p.id));
    const rejected = proposalsCreated.find((p) => !survivorIds.has(p.id))!;

    // Simulate an edit of the rejected proposal during review (touches updatedAt,
    // triggers a new proposalHistory row — but createdAt is stable).
    await db
      .update(proposals)
      .set({ proposalData: { title: `Edited during review ${task.id}` } })
      .where(eq(proposals.id, rejected.id));

    const result = await getProposalsForPhase({
      instanceId,
      phaseId: 'review',
    });
    const ids = result.map((p) => p.id);
    expect(ids).not.toContain(rejected.id);
    expect(ids.sort()).toEqual([...survivorIds].sort());
  });

  it('returns all active proposals for a legacy instance regardless of join table state', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;
    const { userEmail } = setup;

    const [p1, p2] = await Promise.all([
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Legacy proposal 1 ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Legacy proposal 2 ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    // Mutate instanceData to look like a legacy instance: add currentStateId
    // to the JSON blob. Legacy instances stored state in the JSON; new ones don't.
    await db
      .update(processInstances)
      .set({
        instanceData: sql`${processInstances.instanceData} || jsonb_build_object('currentStateId', 'review')`,
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
