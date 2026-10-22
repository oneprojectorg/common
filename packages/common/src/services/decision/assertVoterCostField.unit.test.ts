import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@op/db/client', () => ({
  db: { query: { decisionProcesses: { findFirst: vi.fn() } } },
  eq: vi.fn(),
}));

import { db } from '@op/db/client';

import { ValidationError } from '../../utils';
import { assertVoterCostField } from './assertVoterCostField';
import type { DecisionInstanceData } from './schemas/instanceData';
import type { ProposalTemplateSchema } from './types';

const PROCESS_ID = 'process-1';

const findProcess = vi.mocked(db.query.decisionProcesses.findFirst);

const template = (
  properties: ProposalTemplateSchema['properties'],
): ProposalTemplateSchema => ({
  type: 'object',
  properties: { title: { type: 'string' }, ...properties },
});

const budgetTemplate = template({
  budget: { type: 'object', 'x-format': 'money' },
});

const dotsTemplate = template({
  cost: { type: 'number', 'x-unit': { kind: 'custom', label: 'dots' } },
});

const instanceData = ({
  proposalTemplate,
  voting,
}: {
  proposalTemplate?: ProposalTemplateSchema;
  voting?: { voterBudget?: number; voterCostField?: string };
}): DecisionInstanceData =>
  ({
    ...(proposalTemplate ? { proposalTemplate } : {}),
    phases: [
      { phaseId: 'submission', rules: { proposals: { submit: true } } },
      {
        phaseId: 'voting',
        rules: { voting: { submit: true, maxVotesPerMember: 3, ...voting } },
      },
    ],
  }) as DecisionInstanceData;

describe('assertVoterCostField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts a cap on the default budget field', async () => {
    await expect(
      assertVoterCostField({
        instanceData: instanceData({
          proposalTemplate: budgetTemplate,
          voting: { voterBudget: 5000 },
        }),
        processId: PROCESS_ID,
      }),
    ).resolves.toBeUndefined();
  });

  it('accepts a cap on a numeric field the rules name', async () => {
    await expect(
      assertVoterCostField({
        instanceData: instanceData({
          proposalTemplate: dotsTemplate,
          voting: { voterBudget: 10, voterCostField: 'cost' },
        }),
        processId: PROCESS_ID,
      }),
    ).resolves.toBeUndefined();
  });

  it('rejects a cap whose cost field is missing from the template', async () => {
    await expect(
      assertVoterCostField({
        instanceData: instanceData({
          proposalTemplate: budgetTemplate,
          voting: { voterBudget: 10, voterCostField: 'cost' },
        }),
        processId: PROCESS_ID,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects a cap on a numeric field that declares no unit', async () => {
    await expect(
      assertVoterCostField({
        instanceData: instanceData({
          proposalTemplate: template({ cost: { type: 'number' } }),
          voting: { voterBudget: 10, voterCostField: 'cost' },
        }),
        processId: PROCESS_ID,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects a default-field cap when the template collects no budget', async () => {
    await expect(
      assertVoterCostField({
        instanceData: instanceData({
          proposalTemplate: template({}),
          voting: { voterBudget: 5000 },
        }),
        processId: PROCESS_ID,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('reads the process schema when the instance carries no template', async () => {
    findProcess.mockResolvedValue({
      processSchema: { proposalTemplate: budgetTemplate },
    } as never);

    await expect(
      assertVoterCostField({
        instanceData: instanceData({ voting: { voterBudget: 5000 } }),
        processId: PROCESS_ID,
      }),
    ).resolves.toBeUndefined();
  });

  it('does not read the process schema when no phase carries a cap', async () => {
    await assertVoterCostField({
      instanceData: instanceData({ proposalTemplate: template({}) }),
      processId: PROCESS_ID,
    });

    expect(findProcess).not.toHaveBeenCalled();
  });
});
