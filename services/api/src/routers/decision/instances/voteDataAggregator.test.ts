import { aggregateProposalMetrics } from '@op/common';
import { db, eq } from '@op/db/client';
import { proposals } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  createAndSubmitProposal,
  createInstanceWithSchema,
  schemaWithoutPipeline,
} from '../../../test/helpers/pipelineTestFixtures';

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
    const { instanceId, userEmail, caller } = await createInstanceWithSchema(
      testData,
      task.id,
      schemaWithoutPipeline,
    );

    const proposal = await createAndSubmitProposal(testData, caller, {
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `No votes ${task.id}` },
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
