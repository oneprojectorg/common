import { TestDecisionsDataManager } from '@op/common/testing';
import { db, eq } from '@op/db/client';
import { ProposalStatus, proposals } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { listSmsBallotProposals } from './listSmsBallotProposals';

describe.concurrent('listSmsBallotProposals', () => {
  it('given a legacy snapshot that stores the budget as a numeric string (planted directly, no service writes that shape), then the proposal carries that amount in the default currency', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, proposalId } = await seedProposal(
      task.id,
      onTestFinished,
      { budget: '85000' },
    );

    const rows = await listSmsBallotProposals({
      processInstanceId: instanceId,
    });

    expect(rows.find((row) => row.proposalId === proposalId)).toMatchObject({
      cost: 85_000,
      currency: 'USD',
    });
  });

  it('given a budget stored in the canonical shape, then the proposal carries its amount and currency', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, proposalId } = await seedProposal(
      task.id,
      onTestFinished,
      { budget: { amount: 12_500, currency: 'EUR' } },
    );

    const rows = await listSmsBallotProposals({
      processInstanceId: instanceId,
    });

    expect(rows.find((row) => row.proposalId === proposalId)).toMatchObject({
      cost: 12_500,
      currency: 'EUR',
    });
  });

  it('given a budget with no currency, then the proposal carries no cost rather than an invented one', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, proposalId } = await seedProposal(
      task.id,
      onTestFinished,
      { budget: { amount: 1_000 } },
    );

    const rows = await listSmsBallotProposals({
      processInstanceId: instanceId,
    });

    expect(rows.find((row) => row.proposalId === proposalId)).toMatchObject({
      cost: null,
    });
  });
});

const seedProposal = async (
  testId: string,
  onTestFinished: ConstructorParameters<typeof TestDecisionsDataManager>[1],
  extraProposalData: Record<string, unknown>,
) => {
  const testData = new TestDecisionsDataManager(testId, onTestFinished);
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
  });
  const proposal = await testData.createProposal({
    userEmail: setup.userEmail,
    processInstanceId: setup.instance.instance.id,
    proposalData: { title: `Proposal ${testId}` },
    status: ProposalStatus.SUBMITTED,
  });
  await db
    .update(proposals)
    .set({
      proposalData: { title: `Proposal ${testId}`, ...extraProposalData },
    })
    .where(eq(proposals.id, proposal.id));
  return { instanceId: setup.instance.instance.id, proposalId: proposal.id };
};
