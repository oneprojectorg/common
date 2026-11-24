import { describe, expect, it } from 'vitest';

import {
  type MappingInput,
  type SchemaMapping,
  type SchemaRef,
  mapToSchema,
} from '../../schemaMapping';
import { withBudgetCurrency } from './withBudgetCurrency';

const proposalRef: SchemaRef = { type: 'proposal', phaseId: 'submission' };
const reviewRef: SchemaRef = { type: 'review', phaseId: 'feasibility' };
const targetRef: SchemaRef = { type: 'proposal', phaseId: 'ballot' };

const costTotal: SchemaMapping = {
  from: reviewRef,
  to: targetRef,
  fields: [
    {
      from: {
        operator: 'add',
        operands: [
          { field: 'answers.cost_design.amount' },
          { field: 'answers.cost_construction.amount' },
          { field: 'answers.cost_contingency.amount' },
        ],
      },
      to: 'budget',
    },
  ],
};

const budgetCopy: SchemaMapping = {
  from: proposalRef,
  to: targetRef,
  fields: [{ from: 'budget', to: 'budget' }],
};

const usd = (amount: number) => ({ amount, currency: 'USD' });
const eur = (amount: number) => ({ amount, currency: 'EUR' });

const review = (answers: Record<string, unknown>): MappingInput => ({
  schema: reviewRef,
  data: { answers: { ...answers, __overall_recommendation: 'feasible' } },
});

const proposal = (data: unknown): MappingInput => ({
  schema: proposalRef,
  data,
});

const mapBudget = (
  inputs: MappingInput[],
  mappings: SchemaMapping[] = [costTotal],
) =>
  withBudgetCurrency({
    result: mapToSchema({ mappings, inputs, targetSchema: targetRef }),
    mappings,
    inputs,
    targetSchema: targetRef,
  });

describe('withBudgetCurrency', () => {
  it.each([
    {
      answers: {
        cost_design: usd(20000),
        cost_contingency: usd(20000),
        cost_construction: usd(120000),
      },
      budget: usd(160000),
    },
    {
      answers: { cost_contingency: usd(3600), cost_construction: usd(18000) },
      budget: usd(21600),
    },
    { answers: { cost_construction: usd(5000) }, budget: usd(5000) },
    { answers: { cost_design: usd(500000) }, budget: usd(500000) },
    { answers: { cost_contingency: eur(70) }, budget: eur(70) },
    {
      answers: {
        cost_design: usd(0),
        cost_contingency: usd(5000),
        cost_construction: usd(50000),
      },
      budget: usd(55000),
    },
    {
      answers: {
        cost_design: usd(0),
        cost_contingency: usd(0),
        cost_construction: usd(0),
      },
      budget: usd(0),
    },
  ])(
    'gives the total the currency of the cost fields: $budget.amount $budget.currency',
    ({ answers, budget }) => {
      expect(mapBudget([review(answers)]).data).toEqual({ budget });
    },
  );

  it('gives the budget as an object with a currency, not as a number', () => {
    const { budget } = mapBudget([
      review({ cost_design: usd(10), cost_construction: usd(20) }),
    ]).data;

    expect(budget).toStrictEqual({ amount: 30, currency: 'USD' });
  });

  it('takes the currency over all reviews that agree on the total', () => {
    const result = mapBudget([
      review({}),
      review({ cost_design: usd(100), cost_construction: usd(200) }),
      review({ cost_contingency: usd(300) }),
    ]);

    expect(result.data).toEqual({ budget: usd(300) });
  });

  it.each([
    {
      name: 'two currencies in one review',
      inputs: [review({ cost_design: usd(100), cost_construction: eur(100) })],
    },
    {
      name: 'two currencies in two reviews with the same total',
      inputs: [
        review({ cost_design: usd(100) }),
        review({ cost_design: eur(100) }),
      ],
    },
    {
      name: 'a cost field without a currency',
      inputs: [review({ cost_design: { amount: 100 } })],
    },
    {
      name: 'an empty currency',
      inputs: [review({ cost_design: { amount: 100, currency: '' } })],
    },
    {
      name: 'cost fields that are plain numbers',
      inputs: [review({ cost_design: 100, cost_construction: 200 })],
    },
    {
      name: 'a plain number next to money',
      inputs: [review({ cost_design: usd(100), cost_construction: 250 })],
    },
    {
      name: 'a review without a cost field',
      inputs: [review({})],
    },
  ])('gives no budget for $name', ({ inputs }) => {
    expect(mapBudget(inputs).data).toEqual({});
  });

  it('keeps a number that a copy rule gives when the add rule reads no amount', () => {
    const result = mapBudget(
      [proposal({ budget: 500 }), review({ cost_design: 100 })],
      [costTotal, budgetCopy],
    );

    expect(result.data).toEqual({ budget: 500 });
  });

  it('keeps the other mapped fields', () => {
    const mappings: SchemaMapping[] = [
      costTotal,
      {
        from: proposalRef,
        to: targetRef,
        fields: [{ from: 'title', to: 'title' }],
      },
    ];

    const result = mapBudget(
      [proposal({ title: 'Trees' }), review({ cost_design: eur(5) })],
      mappings,
    );

    expect(result.data).toEqual({ title: 'Trees', budget: eur(5) });
  });
});
