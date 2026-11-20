import { TestDecisionsDataManager } from '@op/common/testing';
import { ProcessStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { getSmsVotingDecision } from './getSmsVotingDecision';

const titleField = { type: 'string', title: 'Title', 'x-format': 'short-text' };

const dotsCostTemplate = {
  type: 'object',
  required: ['title'],
  properties: {
    title: titleField,
    cost: {
      type: 'number',
      title: 'Cost',
      'x-unit': { kind: 'custom', label: 'dots' },
    },
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

const budgetVotingSchema = {
  id: 'sms-voting-decision-budget',
  version: '1.0.0',
  name: 'SMS voting decision budget',
  description: 'A voting phase capped at 10, charged from cost',
  phases: [
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

describe.concurrent('getSmsVotingDecision', () => {
  it('given a voting phase with a budget, then the budget is in the unit of the form the phase names, or of the instance template when it names none', async ({
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
    const readBudget = async () =>
      (
        await getSmsVotingDecision({
          authUserId: setup.user.id,
          decisionSlug: setup.instance.slug,
        })
      ).budget;

    expect(await readBudget()).toBe('10 dots');

    const form = await testData.createFormSchema({
      processInstanceId: instanceId,
      name: 'Entry',
      schema: usdCostForm,
    });
    await testData.setPhaseFormSchemaId({
      instanceId,
      phaseId: 'voting',
      formSchemaId: form.id,
    });

    expect(await readBudget()).toBe('$10');
  });
});
