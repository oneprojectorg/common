import { aggregateProposalMetrics } from '@op/common';
import {
  TestDecisionsDataManager,
  buildVoteAggregation,
  schemaWithRankedBudgetPipeline,
  schemaWithoutPipeline,
  testSimpleVotingSchema,
} from '@op/common/testing';
import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  processInstances,
  proposals,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { createAuthenticatedCaller } from '../../../test/supabase-utils';

async function fetchProposalRow(proposalId: string) {
  const [row] = await db
    .select()
    .from(proposals)
    .where(eq(proposals.id, proposalId));

  if (!row) {
    throw new Error(`Proposal ${proposalId} was not created`);
  }

  return row;
}

/** Published instance in its voting phase with three submitted proposals. */
async function setupVotingInstance(
  testData: TestDecisionsDataManager,
  taskId: string,
  processSchema: NonNullable<
    Parameters<TestDecisionsDataManager['createDecisionSetup']>[0]
  >['processSchema'],
) {
  const setup = await testData.createDecisionSetup({
    processSchema,
    instanceCount: 1,
    grantAccess: true,
    status: ProcessStatus.PUBLISHED,
  });
  const instanceId = setup.instance.instance.id;

  const createSubmitted = async (n: number) => {
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Ranked ${n} ${taskId}` },
      status: ProposalStatus.SUBMITTED,
    });
    return fetchProposalRow(proposal.id);
  };
  const proposalRows = await Promise.all([
    createSubmitted(1),
    createSubmitted(2),
    createSubmitted(3),
  ]);

  await db
    .update(processInstances)
    .set({ currentStateId: 'voting' })
    .where(eq(processInstances.id, instanceId));

  return { setup, instanceId, proposalRows };
}

/** Each proposal's rank counts, keyed by proposal id, for exact comparison. */
function rankCountsById(
  result: Awaited<ReturnType<typeof aggregateProposalMetrics>>,
) {
  return Object.fromEntries(
    Object.values(result).map((metrics) => [
      metrics.proposalId,
      metrics.rankCounts,
    ]),
  );
}

describe.concurrent('aggregateProposalMetrics', () => {
  it('returns empty object for an empty proposals array', async () => {
    const result = await aggregateProposalMetrics([]);
    expect(result).toEqual({});
  });

  it('returns zeroed aggregation for proposals with no votes', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instance.instance.id;
    const { userEmail } = setup;

    const proposal = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `No votes ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });

    const result = await aggregateProposalMetrics([
      await fetchProposalRow(proposal.id),
    ]);

    expect(result[proposal.id]).toEqual(
      buildVoteAggregation({ proposalId: proposal.id }),
    );
  });

  it('counts how many selections ranked each proposal at each rank', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, proposalRows } = await setupVotingInstance(
      testData,
      task.id,
      schemaWithRankedBudgetPipeline,
    );
    const [first, second, third] = proposalRows;

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });
    const [ownerCaller, memberCaller] = await Promise.all([
      createAuthenticatedCaller(setup.userEmail),
      createAuthenticatedCaller(member.email),
    ]);

    await ownerCaller.decision.submitVote({
      processInstanceId: instanceId,
      selectedProposalIds: [first.id, second.id, third.id],
    });
    await memberCaller.decision.submitVote({
      processInstanceId: instanceId,
      selectedProposalIds: [second.id, third.id],
    });

    const result = await aggregateProposalMetrics(proposalRows);

    expect(rankCountsById(result)).toEqual({
      [first.id]: { 1: 1 },
      [second.id]: { 1: 1, 2: 1 },
      [third.id]: { 2: 1, 3: 1 },
    });
    expect(result).toMatchObject({
      [first.id]: { voteCount: 1 },
      [second.id]: { voteCount: 2 },
      [third.id]: { voteCount: 2 },
    });
  });

  it('counts no ranks for an unranked selection', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, proposalRows } = await setupVotingInstance(
      testData,
      task.id,
      testSimpleVotingSchema,
    );
    const [first] = proposalRows;

    const caller = await createAuthenticatedCaller(setup.userEmail);
    await caller.decision.submitVote({
      processInstanceId: instanceId,
      selectedProposalIds: [first.id],
    });

    const result = await aggregateProposalMetrics(proposalRows);

    expect(rankCountsById(result)).toEqual({
      [first.id]: {},
      [proposalRows[1].id]: {},
      [proposalRows[2].id]: {},
    });
    expect(result).toMatchObject({ [first.id]: { voteCount: 1 } });
  });
});
