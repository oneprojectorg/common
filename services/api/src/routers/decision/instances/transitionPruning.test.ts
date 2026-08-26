import { getProposalsForPhase } from '@op/common';
import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  Visibility,
  decisionTransitionProposals,
  proposals,
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

/**
 * Every pruning branch an admin can apply during a collection phase, verified
 * across a pass-all (empty-blocks pipeline) phase advance — the automatic
 * Collect Ideas → Review transition shape. One matrix test rather than one
 * `it` per branch: the setup (instance + a caller + a dozen proposals) is the
 * expensive part, and the point is the branches interacting with the SAME
 * transition snapshot.
 */
describe.concurrent('phase transition: pruning branches', () => {
  it('carries exactly the non-pruned proposals across a pass-all advance — rejected, merged-away, deleted, and drafts stay behind; un-rejected, un-merged, and hidden come along', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;
    const { userEmail } = setup;
    const caller = await createAuthenticatedCaller(userEmail);

    const make = (title: string, status: ProposalStatus) =>
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `${title} ${task.id}` },
        status,
      });

    // One proposal per branch. Names state the expected fate.
    const keeper = await make('keeper', ProposalStatus.SUBMITTED);
    const rejected = await make('rejected', ProposalStatus.SUBMITTED);
    const unrejected = await make('unrejected', ProposalStatus.SUBMITTED);
    const mergedAway = await make('merged away', ProposalStatus.SUBMITTED);
    const mergeTarget = await make('merge target', ProposalStatus.SUBMITTED);
    const unmergedSource = await make('unmerged', ProposalStatus.SUBMITTED);
    const unmergedTarget = await make(
      'unmerge target',
      ProposalStatus.SUBMITTED,
    );
    const deleted = await make('deleted', ProposalStatus.SUBMITTED);
    await make('never submitted', ProposalStatus.DRAFT);
    const hidden = await make('hidden', ProposalStatus.SUBMITTED);
    const duplicateStatus = await make('duplicate', ProposalStatus.SUBMITTED);

    // Apply each prune through the real admin mutations, not DB writes, so
    // the test breaks if a mutation stops producing the pruning state.
    await caller.decision.rejectProposal({ proposalId: rejected.id });
    await caller.decision.rejectProposal({ proposalId: unrejected.id });
    await caller.decision.unrejectProposal({ proposalId: unrejected.id });
    await caller.decision.mergeProposals({
      sourceProposalId: mergedAway.id,
      targetProposalId: mergeTarget.id,
    });
    await caller.decision.mergeProposals({
      sourceProposalId: unmergedSource.id,
      targetProposalId: unmergedTarget.id,
    });
    await caller.decision.unmergeProposal({
      sourceProposalId: unmergedSource.id,
    });
    await caller.decision.deleteProposal({ proposalId: deleted.id });
    // Hiding and the DUPLICATE status have no admin mutation on this path —
    // they exist to pin that neither prunes phase membership.
    await db
      .update(proposals)
      .set({ visibility: Visibility.HIDDEN })
      .where(eq(proposals.id, hidden.id));
    await db
      .update(proposals)
      .set({ status: ProposalStatus.DUPLICATE })
      .where(eq(proposals.id, duplicateStatus.id));

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const expectedSurvivors = new Set([
      keeper.id,
      unrejected.id,
      mergeTarget.id,
      unmergedSource.id,
      unmergedTarget.id,
      hidden.id,
      duplicateStatus.id,
    ]);

    // The advance snapshot (route "a": attachment to the inbound transition)
    // must contain exactly the survivors.
    const [transition] = await db
      .select()
      .from(stateTransitionHistory)
      .where(eq(stateTransitionHistory.processInstanceId, instanceId))
      .limit(1);
    expect(transition).toBeDefined();
    const joinRows = await db
      .select({ proposalId: decisionTransitionProposals.proposalId })
      .from(decisionTransitionProposals)
      .where(
        eq(decisionTransitionProposals.transitionHistoryId, transition!.id),
      );
    expect(new Set(joinRows.map((r) => r.proposalId))).toEqual(
      expectedSurvivors,
    );

    // And phase membership must agree with the snapshot.
    const reviewProposals = await getProposalsForPhase({
      instanceId,
      phaseId: 'review',
    });
    expect(new Set(reviewProposals.map((p) => p.id))).toEqual(
      expectedSurvivors,
    );
  });

  it('drops a proposal from the phase it already advanced into when it is rejected or merged after the transition, and restores it on un-reject', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;
    const { userEmail } = setup;
    const caller = await createAuthenticatedCaller(userEmail);

    const keeper = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `keeper ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });
    const lateRejected = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `rejected late ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });
    const lateMerged = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `merged late ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    // All three survived the advance; prune two of them afterwards.
    await caller.decision.rejectProposal({ proposalId: lateRejected.id });
    await caller.decision.mergeProposals({
      sourceProposalId: lateMerged.id,
      targetProposalId: keeper.id,
    });

    // Attachment is necessary but not sufficient: the snapshot is re-filtered
    // for eligibility at read time, so the post-transition prunes disappear
    // from the phase they had already entered.
    const afterPrune = await getProposalsForPhase({
      instanceId,
      phaseId: 'review',
    });
    expect(afterPrune.map((p) => p.id)).toEqual([keeper.id]);

    // Un-reject brings the attached proposal back into the phase.
    await caller.decision.unrejectProposal({ proposalId: lateRejected.id });
    const afterRestore = await getProposalsForPhase({
      instanceId,
      phaseId: 'review',
    });
    expect(new Set(afterRestore.map((p) => p.id))).toEqual(
      new Set([keeper.id, lateRejected.id]),
    );
  });
});
