import { mockCollab } from '@op/collab/testing';
import { TestDecisionsDataManager } from '@op/common/testing';
import { ProcessStatus, ProposalStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { BallotCostError } from '../../../utils';
import { parseProposalData } from '../proposalDataSchema';
import { addSmsBallotPicks } from './smsBallot';

const DOTS = { kind: 'custom', label: 'dots' } as const;

const titleField = { type: 'string', title: 'Title', 'x-format': 'short-text' };

const dotsCostTemplate = {
  type: 'object',
  required: ['title'],
  properties: {
    title: titleField,
    cost: { type: 'number', title: 'Cost', 'x-unit': DOTS },
  },
};

const usdCostForm = {
  type: 'object',
  required: ['title'],
  properties: {
    title: titleField,
    cost: {
      type: 'object',
      title: 'Cost',
      'x-format': 'money',
      properties: {
        amount: { type: 'number' },
        currency: { type: 'string', default: 'USD' },
      },
    },
  },
};

const unpricedForm = {
  type: 'object',
  required: ['title'],
  properties: { title: titleField },
};

const budgetVotingSchema = {
  id: 'sms-ballot-budget',
  version: '1.0.0',
  name: 'SMS ballot budget',
  description: 'A submission phase followed by a voting phase capped in dots',
  phases: [
    {
      id: 'submission',
      name: 'Submission',
      rules: { proposals: { submit: true }, voting: { submit: false } },
      selectionPipeline: {
        version: '1.0.0',
        blocks: [{ id: 'all', type: 'limit', count: 10 }],
      },
    },
    {
      id: 'voting',
      name: 'Voting',
      rules: {
        proposals: { submit: false },
        voting: { submit: true, voterBudget: 10, voterCostField: 'cost' },
      },
    },
  ],
};

describe.concurrent('addSmsBallotPicks', () => {
  it('given a budget in dots, when a voter picks proposals by code, then one priced in dots is added and one whose own form prices the cost in another unit, or not at all, is refused', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
      processSchema: budgetVotingSchema,
      proposalTemplate: dotsCostTemplate,
    });
    const instanceId = setup.instance.instance.id;
    const [usdForm, noCostForm] = await Promise.all([
      testData.createFormSchema({
        processInstanceId: instanceId,
        name: 'USD entry',
        schema: usdCostForm,
      }),
      testData.createFormSchema({
        processInstanceId: instanceId,
        name: 'Unpriced entry',
        schema: unpricedForm,
      }),
    ]);

    const seeded = [
      { title: 'In dots', cost: '3', formSchemaId: undefined },
      {
        title: 'In dollars',
        cost: JSON.stringify({ amount: 3, currency: 'USD' }),
        formSchemaId: usdForm.id,
      },
      { title: 'Unpriced', cost: '3', formSchemaId: noCostForm.id },
    ];
    for (const { title, cost, formSchemaId } of seeded) {
      const proposal = await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title },
        status: ProposalStatus.SUBMITTED,
        ...(formSchemaId ? { formSchemaId } : {}),
      });
      const { collaborationDocId } = parseProposalData(proposal.proposalData);
      if (!collaborationDocId) {
        throw new Error(
          `Proposal ${proposal.id} has no collaboration document`,
        );
      }
      mockCollab.setDocFragments(collaborationDocId, { title, cost });
    }
    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'voting',
    });
    const pick = (code: number) =>
      addSmsBallotPicks({
        authUserId: setup.user.id,
        instanceId,
        codes: [code],
      });

    const added = await pick(101);
    expect(added.results).toMatchObject([
      { status: 'added', pick: { title: 'In dots', cost: 3 } },
    ]);

    await expect(pick(102)).rejects.toBeInstanceOf(BallotCostError);
    await expect(pick(103)).rejects.toBeInstanceOf(BallotCostError);
  });
});
