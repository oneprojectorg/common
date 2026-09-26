import { beforeEach, describe, expect, it, vi } from 'vitest';

// Only the process-schema fallback inside `resolveProposalTemplate` reaches
// the database; everything else under test is pure.
vi.mock('@op/db/client', () => ({
  db: { query: { decisionProcesses: { findFirst: vi.fn() } } },
  eq: vi.fn(),
}));

// The module imports analytics at load, which builds a PostHog client from
// env this suite has no business providing.
vi.mock('@op/analytics', () => ({
  trackAdminSetProcess: vi.fn(),
  trackAdminSetRubric: vi.fn(),
}));

import { db } from '@op/db/client';

import type { DecisionInstanceData } from './schemas/instanceData';
import type { ProposalTemplateSchema } from './types';
import { stripUnbackedVoterBudgets } from './updateDecisionInstance';

const PROCESS_ID = 'process-1';

const findProcess = vi.mocked(db.query.decisionProcesses.findFirst);

const budgetTemplate: ProposalTemplateSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    budget: { type: 'object', 'x-format': 'money' },
  },
};

const noBudgetTemplate: ProposalTemplateSchema = {
  type: 'object',
  properties: { title: { type: 'string' } },
};

const instanceData = ({
  proposalTemplate,
  voterBudget,
}: {
  proposalTemplate?: ProposalTemplateSchema;
  voterBudget?: number;
}): DecisionInstanceData =>
  ({
    ...(proposalTemplate ? { proposalTemplate } : {}),
    phases: [
      { phaseId: 'submission', rules: { proposals: { submit: true } } },
      {
        phaseId: 'voting',
        rules: {
          voting: {
            submit: true,
            maxVotesPerMember: 3,
            ...(voterBudget !== undefined && { voterBudget }),
          },
        },
      },
    ],
  }) as DecisionInstanceData;

const votingRules = (data: DecisionInstanceData) =>
  data.phases.find((phase) => phase.phaseId === 'voting')?.rules?.voting;

describe('stripUnbackedVoterBudgets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('drops the cap when the template no longer collects a budget', async () => {
    const result = await stripUnbackedVoterBudgets(
      instanceData({ proposalTemplate: noBudgetTemplate, voterBudget: 5000 }),
      PROCESS_ID,
    );

    expect(votingRules(result)).toEqual({
      submit: true,
      maxVotesPerMember: 3,
    });
  });

  it('keeps the cap when the template still collects a budget', async () => {
    const result = await stripUnbackedVoterBudgets(
      instanceData({ proposalTemplate: budgetTemplate, voterBudget: 5000 }),
      PROCESS_ID,
    );

    expect(votingRules(result)?.voterBudget).toBe(5000);
  });

  // An instance that never overrode the template still collects whatever the
  // process schema declares — stripping there would delete a valid cap.
  it('keeps the cap when only the process schema declares the budget field', async () => {
    findProcess.mockResolvedValue({
      processSchema: { proposalTemplate: budgetTemplate },
    } as never);

    const result = await stripUnbackedVoterBudgets(
      instanceData({ voterBudget: 5000 }),
      PROCESS_ID,
    );

    expect(votingRules(result)?.voterBudget).toBe(5000);
  });

  it('does not read the process schema when no phase carries a cap', async () => {
    const data = instanceData({ proposalTemplate: noBudgetTemplate });

    await expect(stripUnbackedVoterBudgets(data, PROCESS_ID)).resolves.toBe(
      data,
    );
    expect(findProcess).not.toHaveBeenCalled();
  });
});
