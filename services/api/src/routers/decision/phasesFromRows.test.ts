import {
  type DecisionSchemaDefinition,
  assertCustomFormAdmin,
  duplicateInstance,
  getVotingProgress,
  processDecisionsTransitions,
  revertPhase,
} from '@op/common';
import { TestDecisionsDataManager } from '@op/common/testing';
import { db, eq, sql } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  decisionProcessTransitions,
  processInstances,
  processPhases,
  profiles,
  proposalReviewAssignments,
  users,
} from '@op/db/schema';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { appRouter } from '..';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

const passAll = { version: '1.0.0' as const, blocks: [] };

const manualSchema = {
  id: 'rows-manual',
  version: '1.0.0',
  name: 'Rows Manual Schema',
  phases: [
    {
      id: 'initial',
      name: 'Initial',
      rules: {
        proposals: { submit: true },
        advancement: { method: 'manual' },
      },
      selectionPipeline: passAll,
    },
    {
      id: 'final',
      name: 'Final',
      rules: { advancement: { method: 'manual' } },
    },
  ],
} satisfies DecisionSchemaDefinition;

const dateSchema = {
  ...manualSchema,
  id: 'rows-date',
  phases: [
    {
      id: 'initial',
      name: 'Initial',
      rules: {
        proposals: { submit: true },
        advancement: { method: 'date' },
      },
      selectionPipeline: passAll,
    },
    {
      id: 'final',
      name: 'Final',
      rules: { advancement: { method: 'date' } },
    },
  ],
} satisfies DecisionSchemaDefinition;

const votingSchema = {
  id: 'rows-voting',
  version: '1.0.0',
  name: 'Rows Voting Schema',
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      rules: {
        proposals: { submit: true },
        advancement: { method: 'manual' },
      },
    },
    {
      id: 'voting',
      name: 'Voting',
      rules: {
        voting: { submit: true },
        advancement: { method: 'manual' },
      },
    },
    {
      id: 'results',
      name: 'Results',
      rules: { advancement: { method: 'manual' } },
    },
  ],
} satisfies DecisionSchemaDefinition;

const reviewSchema = {
  id: 'rows-review',
  version: '1.0.0',
  name: 'Rows Review Schema',
  config: { reviewsPolicy: 'full_coverage' },
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      rules: {
        proposals: { submit: true },
        advancement: { method: 'manual' },
      },
      selectionPipeline: passAll,
    },
    {
      id: 'review',
      name: 'Review',
      rules: {
        reviews: { submit: true },
        advancement: { method: 'manual' },
      },
    },
    {
      id: 'results',
      name: 'Results',
      rules: { advancement: { method: 'manual' } },
    },
  ],
} satisfies DecisionSchemaDefinition;

/** Leaves the phase rows as the only record of the decision's phases. */
const emptyBlobPhases = (instanceId: string) =>
  db
    .update(processInstances)
    .set({
      instanceData: sql`jsonb_set(${processInstances.instanceData}, '{phases}', '[]')`,
    })
    .where(eq(processInstances.id, instanceId));

const ROW_START = '2031-01-01T00:00:00.000Z';
const ROW_END = '2031-02-01T00:00:00.000Z';

/** Gives every row a name and dates the blob never held. */
const rewriteRows = async (instanceId: string) => {
  await db
    .update(processPhases)
    .set({
      data: sql`${processPhases.data} || ${JSON.stringify({ startDate: ROW_START, endDate: ROW_END })}::jsonb`,
    })
    .where(eq(processPhases.processInstanceId, instanceId));
  await db
    .update(profiles)
    .set({ name: sql`'Row ' || (${processPhases.data} ->> 'phaseId')` })
    .from(processPhases)
    .where(
      sql`${profiles.id} = ${processPhases.profileId} AND ${processPhases.processInstanceId} = ${instanceId}`,
    );
};

/** Rows rewritten, blob phases emptied: only the rows can answer. */
const leaveOnlyRows = async (instanceId: string) => {
  await rewriteRows(instanceId);
  await emptyBlobPhases(instanceId);
};

const rowPhases = (phaseIds: string[]) =>
  phaseIds.map((phaseId) => ({
    phaseId,
    name: `Row ${phaseId}`,
    startDate: ROW_START,
    endDate: ROW_END,
  }));

// Not concurrent: the transitions sweep is global, and the flag is forced
// through the environment for the whole file.
describe('with process_phases_from_rows on and instanceData.phases empty', () => {
  beforeAll(() => {
    vi.stubEnv('NEXT_PUBLIC_E2E', 'true');
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('advances a phase and reads the phases back from the rows', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
      processSchema: manualSchema,
    });
    const instanceId = setup.instance.instance.id;
    await leaveOnlyRows(instanceId);

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.transitionFromPhase({ instanceId });

    expect(result).toEqual({
      previousPhaseId: 'initial',
      currentPhaseId: 'final',
    });

    const instance = await caller.decision.getInstance({ instanceId });
    expect(
      instance.instanceData.phases?.map(
        ({ phaseId, name, startDate, endDate }) => ({
          phaseId,
          name,
          startDate,
          endDate,
        }),
      ),
    ).toEqual(rowPhases(['initial', 'final']));
  });

  it('runs a due transition in the sweep', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
      processSchema: dateSchema,
    });
    const instanceId = setup.instance.instance.id;
    await emptyBlobPhases(instanceId);
    // Not yet due, so no other worker's sweep can take it.
    await db.insert(decisionProcessTransitions).values({
      processInstanceId: instanceId,
      fromStateId: 'initial',
      toStateId: 'final',
      scheduledDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });

    const result = await processDecisionsTransitions({
      processInstanceId: instanceId,
      now: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    });

    expect(result).toMatchObject({ processed: 1, failed: 0 });
    const instance = await db.query.processInstances.findFirst({
      where: { id: instanceId },
      columns: { currentStateId: true },
    });
    expect(instance?.currentStateId).toBe('final');
  });

  it('accepts a vote in the voting phase', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      processSchema: votingSchema,
    });
    const instanceId = setup.instance.instance.id;
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'Rows proposal' },
      status: ProposalStatus.SUBMITTED,
    });
    await db
      .update(processInstances)
      .set({ currentStateId: 'voting' })
      .where(eq(processInstances.id, instanceId));
    await emptyBlobPhases(instanceId);

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const vote = await caller.decision.submitVote({
      processInstanceId: instanceId,
      selectedProposalIds: [proposal.id],
    });

    expect(vote.selectedProposalIds).toEqual([proposal.id]);
  });

  it('creates and submits a proposal', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      processSchema: manualSchema,
    });
    const instanceId = setup.instance.instance.id;
    await emptyBlobPhases(instanceId);

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const draft = await caller.decision.createProposal({
      processInstanceId: instanceId,
      proposalData: { title: 'Rows proposal' },
    });
    testData.trackProfileForCleanup(draft.profileId);
    const submitted = await caller.decision.submitProposal({
      proposalId: draft.id,
    });

    expect(submitted.status).toBe(ProposalStatus.SUBMITTED);
  });

  it('assigns reviews on advancing into a review phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
      processSchema: reviewSchema,
    });
    const instanceId = setup.instance.instance.id;
    const author = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });
    const proposal = await testData.createProposal({
      userEmail: author.email,
      processInstanceId: instanceId,
      proposalData: { title: 'Rows proposal' },
      status: ProposalStatus.SUBMITTED,
    });
    await emptyBlobPhases(instanceId);

    const caller = await createAuthenticatedCaller(setup.userEmail);
    await caller.decision.transitionFromPhase({ instanceId });

    const [creator] = await db
      .select({ profileId: users.profileId })
      .from(users)
      .where(eq(users.authUserId, setup.user.id));
    const assignments = await db
      .select({
        proposalId: proposalReviewAssignments.proposalId,
        reviewerProfileId: proposalReviewAssignments.reviewerProfileId,
      })
      .from(proposalReviewAssignments)
      .where(eq(proposalReviewAssignments.processInstanceId, instanceId));

    expect(assignments).toEqual([
      { proposalId: proposal.id, reviewerProfileId: creator?.profileId },
    ]);
  });
  it('reports days left on the voting progress', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
      processSchema: manualSchema,
    });
    const instanceId = setup.instance.instance.id;
    await leaveOnlyRows(instanceId);

    const progress = await getVotingProgress({
      user: setup.user,
      processInstanceId: instanceId,
    });

    expect(progress.daysLeft).toBeGreaterThan(0);
  });

  it('lists the decision with its row phases', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      processSchema: manualSchema,
    });
    const instanceId = setup.instance.instance.id;
    await leaveOnlyRows(instanceId);

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const list = await caller.decision.listDecisionProfiles({});
    const listed = list.items.find(
      (item) => item.processInstance.id === instanceId,
    );

    expect(
      listed?.processInstance.instanceData.phases?.map(({ name }) => name),
    ).toEqual(['Row initial', 'Row final']);
  });

  it('reverts a phase', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
      processSchema: manualSchema,
    });
    const instanceId = setup.instance.instance.id;
    await leaveOnlyRows(instanceId);
    const caller = await createAuthenticatedCaller(setup.userEmail);
    await caller.decision.transitionFromPhase({ instanceId });

    const result = await revertPhase({ instanceId });

    expect(result).toEqual({
      currentPhaseId: 'initial',
      revertedPhaseId: 'final',
    });
  });

  it('duplicates the row phases', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      processSchema: manualSchema,
    });
    const instanceId = setup.instance.instance.id;
    await leaveOnlyRows(instanceId);

    const copy = await duplicateInstance({
      instanceId,
      name: `Copy ${task.id}`,
      include: {
        processSettings: true,
        phases: true,
        proposalCategories: true,
        proposalTemplate: true,
        reviewSettings: true,
        reviewRubric: true,
        roles: false,
      },
      user: setup.user,
    });
    testData.trackProfileForCleanup(copy.id);

    const copied = await db.query.processInstances.findFirst({
      where: { profileId: copy.id },
      columns: { instanceData: true },
    });
    expect(copied?.instanceData).toMatchObject({
      phases: [
        { phaseId: 'initial', name: 'Row initial' },
        { phaseId: 'final', name: 'Row final' },
      ],
    });
  });

  it('lets a custom form name a row phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      processSchema: manualSchema,
    });
    await leaveOnlyRows(setup.instance.instance.id);

    const context = await assertCustomFormAdmin({
      user: setup.user,
      profileId: setup.instance.profileId,
    });

    expect(context).toMatchObject({
      initialPhaseId: 'initial',
      phaseIds: ['initial', 'final'],
    });
  });
});
