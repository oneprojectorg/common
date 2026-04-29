import { and, db, eq } from '@op/db/client';
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
import { createAuthenticatedCaller } from '../../../test/supabase-utils';

describe.concurrent('listProposals: phase-scoped proposal visibility', () => {
  it('returns only selected proposals after a transition with a limiting pipeline', async ({
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
    const caller = await createAuthenticatedCaller(userEmail);

    // Create and submit 3 proposals; the pipeline limits to 2
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
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;
    const { userEmail } = setup;
    const caller = await createAuthenticatedCaller(userEmail);

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
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;
    const { userEmail } = setup;
    const caller = await createAuthenticatedCaller(userEmail);

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

    await testData.advancePhase({
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
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;
    const { userEmail } = setup;
    const caller = await createAuthenticatedCaller(userEmail);

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
    await testData.advancePhase({
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

  it('shows the creator their draft when viewing the phase it was created in', async ({
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
    const caller = await createAuthenticatedCaller(userEmail);

    const draft = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Phase-1 draft ${task.id}` },
    });

    const result = await caller.decision.listProposals({
      processInstanceId: instanceId,
      phaseId: 'submission',
    });

    expect(result.proposals.map((p) => p.id)).toContain(draft.id);
  });

  it('hides a phase-1 draft from the creator after the instance advances to phase 2', async ({
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
    const caller = await createAuthenticatedCaller(userEmail);

    const draft = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Phase-1 draft ${task.id}` },
    });

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    // Default phaseId resolves to the current phase (review). The phase-1 draft
    // should NOT be visible.
    const reviewResult = await caller.decision.listProposals({
      processInstanceId: instanceId,
    });
    expect(reviewResult.proposals.map((p) => p.id)).not.toContain(draft.id);

    // Explicit phaseId='review' should likewise hide it.
    const reviewExplicit = await caller.decision.listProposals({
      processInstanceId: instanceId,
      phaseId: 'review',
    });
    expect(reviewExplicit.proposals.map((p) => p.id)).not.toContain(draft.id);

    // Querying back at the creation phase should re-surface the draft.
    const submissionResult = await caller.decision.listProposals({
      processInstanceId: instanceId,
      phaseId: 'submission',
    });
    expect(submissionResult.proposals.map((p) => p.id)).toContain(draft.id);
  });

  it('shows a draft created in the current phase when no phaseId is passed', async ({
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
    const caller = await createAuthenticatedCaller(userEmail);

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const draftInReview = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Phase-2 draft ${task.id}` },
    });

    const result = await caller.decision.listProposals({
      processInstanceId: instanceId,
    });

    expect(result.proposals.map((p) => p.id)).toContain(draftInReview.id);
  });

  it('shows all drafts for legacy instances regardless of phaseId', async ({
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
    const caller = await createAuthenticatedCaller(userEmail);

    const draft = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Legacy draft ${task.id}` },
    });

    // Mark the instance as legacy by stamping `currentStateId` into instanceData.
    const instanceRow = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instanceId),
    });
    const legacyData = {
      ...((instanceRow?.instanceData as Record<string, unknown> | null) ?? {}),
      currentStateId: 'submission',
    };
    await db
      .update(processInstances)
      .set({ instanceData: legacyData })
      .where(eq(processInstances.id, instanceId));

    // Legacy instances bypass phase scoping for drafts (and non-drafts).
    const result = await caller.decision.listProposals({
      processInstanceId: instanceId,
      phaseId: 'review',
    });
    expect(result.proposals.map((p) => p.id)).toContain(draft.id);
  });

  it('places a draft created exactly at the inbound transition timestamp into the new phase (half-open window)', async ({
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
    const caller = await createAuthenticatedCaller(userEmail);

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const [inbound] = await db
      .select({ transitionedAt: stateTransitionHistory.transitionedAt })
      .from(stateTransitionHistory)
      .where(
        and(
          eq(stateTransitionHistory.processInstanceId, instanceId),
          eq(stateTransitionHistory.toStateId, 'review'),
        ),
      );
    expect(inbound).toBeDefined();

    const draft = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Boundary draft ${task.id}` },
    });
    // Pin the draft's createdAt to the exact transition timestamp.
    await db
      .update(proposals)
      .set({ createdAt: inbound!.transitionedAt.toISOString() })
      .where(eq(proposals.id, draft.id));

    // The boundary draft must land in the post-transition phase (review), not
    // the pre-transition phase (submission).
    const submissionResult = await caller.decision.listProposals({
      processInstanceId: instanceId,
      phaseId: 'submission',
    });
    expect(submissionResult.proposals.map((p) => p.id)).not.toContain(draft.id);

    const reviewResult = await caller.decision.listProposals({
      processInstanceId: instanceId,
      phaseId: 'review',
    });
    expect(reviewResult.proposals.map((p) => p.id)).toContain(draft.id);
  });
});
