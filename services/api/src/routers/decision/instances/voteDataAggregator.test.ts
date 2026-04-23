import { aggregateProposalMetrics } from '@op/common';
import { db, eq } from '@op/db/client';
import { ProcessStatus, ProposalStatus, proposals } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { schemaWithoutPipeline } from '../../../test/helpers/pipelineSchemas';

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
    const instanceId = setup.instances[0]!.instance.id;
    const { userEmail } = setup;

    const proposal = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `No votes ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });

    // Fetch the full proposal row from DB
    const [fullProposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, proposal.id));

    const result = await aggregateProposalMetrics([fullProposal!]);

    expect(result[proposal.id]).toBeDefined();
    expect(result[proposal.id]!.voteCount).toBe(0);
    expect(result[proposal.id]!.approvalCount).toBe(0);
    expect(result[proposal.id]!.rejectionCount).toBe(0);
    expect(result[proposal.id]!.abstainCount).toBe(0);
    expect(result[proposal.id]!.approvalRate).toBe(0);
    expect(result[proposal.id]!.votes).toEqual([]);
  });
});
