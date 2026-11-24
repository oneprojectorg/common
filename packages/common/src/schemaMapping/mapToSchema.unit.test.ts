import { describe, expect, it } from 'vitest';

import { mapToSchema } from './mapToSchema';
import type {
  FieldMapping,
  MappingInput,
  SchemaMapping,
  SchemaRef,
} from './schema';

const proposalRef: SchemaRef = { type: 'proposal', phaseId: 'submission' };
const reviewRef: SchemaRef = { type: 'review', phaseId: 'feasibility' };
const targetRef: SchemaRef = { type: 'proposal', phaseId: 'ballot' };

const mapProposals = ({
  fields,
  inputs,
  to = targetRef,
}: {
  fields: FieldMapping[];
  inputs: MappingInput[];
  to?: SchemaRef;
}) =>
  mapToSchema({
    mappings: [{ from: proposalRef, to, fields }],
    inputs,
    targetSchema: targetRef,
  });

const proposal = (data: unknown): MappingInput => ({
  schema: proposalRef,
  data,
});

const review = (data: unknown): MappingInput => ({
  schema: reviewRef,
  data,
});

describe('mapToSchema', () => {
  it('copies a field', () => {
    const result = mapProposals({
      fields: [
        { from: 'location', to: 'place' },
        { from: 'cost.amount', to: 'budget' },
      ],
      inputs: [
        proposal({ location: { lat: 1, lng: 2 }, cost: { amount: 50 } }),
      ],
    });

    expect(result.data).toEqual({ place: { lat: 1, lng: 2 }, budget: 50 });
  });

  it('skips an empty source field', () => {
    const result = mapProposals({
      fields: [
        { from: 'title', to: 'title' },
        { from: 'summary', to: 'summary' },
        { from: 'missing', to: 'missing' },
      ],
      inputs: [proposal({ title: '', summary: null })],
    });

    expect(result).toEqual({ data: {} });
  });

  it('fills the field when one input is empty and another has a value', () => {
    const result = mapProposals({
      fields: [{ from: 'title', to: 'title' }],
      inputs: [proposal({ title: '' }), proposal({ title: 'Trees' })],
    });

    expect(result.data).toEqual({ title: 'Trees' });
  });

  it('does not read an inherited property', () => {
    const result = mapProposals({
      fields: [{ from: 'toString', to: 'title' }],
      inputs: [proposal({ title: 'Trees' })],
    });

    expect(result).toEqual({ data: {} });
  });

  it('fills the field when all inputs give equal values', () => {
    const result = mapProposals({
      fields: [{ from: 'title', to: 'title' }],
      inputs: [proposal({ title: 'Trees' }), proposal({ title: 'Trees' })],
    });

    expect(result.data).toEqual({ title: 'Trees' });
  });

  it('leaves the field empty when inputs give different values', () => {
    const result = mapProposals({
      fields: [{ from: 'title', to: 'title' }],
      inputs: [proposal({ title: 'Trees' }), proposal({ title: 'Benches' })],
    });

    expect(result).toEqual({ data: {} });
  });

  it('skips inputs of another source schema', () => {
    const result = mapProposals({
      fields: [{ from: 'title', to: 'title' }],
      inputs: [{ schema: reviewRef, data: { title: 'Trees' } }],
    });

    expect(result).toEqual({ data: {} });
  });

  it('skips mappings for another target schema', () => {
    const result = mapProposals({
      fields: [{ from: 'title', to: 'title' }],
      inputs: [proposal({ title: 'Trees' })],
      to: { type: 'proposal', phaseId: 'other' },
    });

    expect(result).toEqual({ data: {} });
  });

  it('fills fields from mappings of different source schemas', () => {
    const result = mapToSchema({
      mappings: [
        {
          from: proposalRef,
          to: targetRef,
          fields: [{ from: 'title', to: 'title' }],
        },
        {
          from: reviewRef,
          to: targetRef,
          fields: [{ from: 'cost.amount', to: 'budget' }],
        },
      ],
      inputs: [proposal({ title: 'Trees' }), review({ cost: { amount: 50 } })],
      targetSchema: targetRef,
    });

    expect(result.data).toEqual({ title: 'Trees', budget: 50 });
  });

  it('fills a field that two mappings write when their values are equal', () => {
    const result = mapToSchema({
      mappings: [
        {
          from: proposalRef,
          to: targetRef,
          fields: [{ from: 'title', to: 'title' }],
        },
        {
          from: reviewRef,
          to: targetRef,
          fields: [{ from: 'name', to: 'title' }],
        },
      ],
      inputs: [proposal({ title: 'Trees' }), review({ name: 'Trees' })],
      targetSchema: targetRef,
    });

    expect(result.data).toEqual({ title: 'Trees' });
  });

  it('leaves a field empty when two mappings write different values', () => {
    const result = mapToSchema({
      mappings: [
        {
          from: proposalRef,
          to: targetRef,
          fields: [{ from: 'title', to: 'title' }],
        },
        {
          from: reviewRef,
          to: targetRef,
          fields: [{ from: 'name', to: 'title' }],
        },
      ],
      inputs: [proposal({ title: 'Trees' }), review({ name: 'Benches' })],
      targetSchema: targetRef,
    });

    expect(result).toEqual({ data: {} });
  });
});

describe('mapToSchema with an add rule', () => {
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

  const costs = ({
    design,
    construction,
    contingency,
  }: {
    design?: unknown;
    construction?: unknown;
    contingency?: unknown;
  }) => ({
    answers: {
      ...(design === undefined ? {} : { cost_design: design }),
      ...(construction === undefined
        ? {}
        : { cost_construction: construction }),
      ...(contingency === undefined ? {} : { cost_contingency: contingency }),
      __overall_recommendation: 'feasible',
    },
  });

  const mapCosts = (
    inputs: MappingInput[],
    mappings: SchemaMapping[] = [costTotal],
  ) => mapToSchema({ mappings, inputs, targetSchema: targetRef });

  it.each([
    { design: 20000, contingency: 20000, construction: 120000, budget: 160000 },
    { contingency: 3600, construction: 18000, budget: 21600 },
    { construction: 5000, budget: 5000 },
    { design: 500000, budget: 500000 },
    { design: 0, contingency: 5000, construction: 50000, budget: 55000 },
    {
      design: 50322.58,
      contingency: 50322.58,
      construction: 289354.84,
      budget: 390000,
    },
    {
      design: 46451.61,
      contingency: 46451.61,
      construction: 267096.77,
      budget: 359999.99,
    },
    {
      design: 60387.1,
      contingency: 60387.1,
      construction: 45290.32,
      budget: 166064.52,
    },
    {
      design: 10000000,
      contingency: 10000000,
      construction: 50000000,
      budget: 70000000,
    },
    { design: 0, contingency: 0, construction: 0, budget: 0 },
    { design: 0.1, construction: 0.2, budget: 0.3 },
  ])(
    'fills the total of the cost fields of one review: $budget',
    ({ design, construction, contingency, budget }) => {
      const result = mapCosts([
        proposal({}),
        review(
          costs({
            design: design === undefined ? undefined : usd(design),
            construction:
              construction === undefined ? undefined : usd(construction),
            contingency:
              contingency === undefined ? undefined : usd(contingency),
          }),
        ),
      ]);

      expect(result.data).toEqual({ budget });
    },
  );

  it('leaves the field empty for a review without a cost field', () => {
    const result = mapCosts([review(costs({}))]);

    expect(result).toEqual({ data: {} });
  });

  it('skips a review without a cost field and fills the total of the other review', () => {
    const result = mapCosts([
      review(costs({})),
      review(
        costs({
          design: usd(12000),
          contingency: usd(12000),
          construction: usd(60000),
        }),
      ),
    ]);

    expect(result.data).toEqual({ budget: 84000 });
  });

  it('reads a null or empty cost field as missing', () => {
    const result = mapCosts([
      review(costs({ design: null, contingency: '', construction: usd(40) })),
    ]);

    expect(result.data).toEqual({ budget: 40 });
  });

  it('leaves the field empty when two reviews give different totals', () => {
    const result = mapCosts([
      review(costs({ construction: usd(5000) })),
      review(
        costs({
          design: usd(0),
          contingency: usd(25000),
          construction: usd(250000),
        }),
      ),
    ]);

    expect(result).toEqual({ data: {} });
  });

  it('fills the total when two reviews with different fields give the same total', () => {
    const result = mapCosts([
      review(costs({ design: usd(100), construction: usd(200) })),
      review(costs({ contingency: usd(300) })),
    ]);

    expect(result.data).toEqual({ budget: 300 });
  });

  it.each([
    {
      name: 'an amount with a thousands separator',
      cost: { amount: '1,000', currency: 'USD' },
    },
    {
      name: 'an amount with a currency sign',
      cost: { amount: '$500', currency: 'USD' },
    },
    { name: 'a null amount', cost: { amount: null, currency: 'USD' } },
    { name: 'an infinite amount', cost: { amount: Infinity, currency: 'USD' } },
  ])(
    'leaves the field empty for $name, also when another review gives a total',
    ({ cost }) => {
      const result = mapCosts([
        review(costs({ design: cost, construction: usd(100) })),
        review(costs({ construction: usd(200) })),
      ]);

      expect(result).toEqual({ data: {} });
    },
  );

  it('adds the amounts of two currencies as one number', () => {
    const result = mapCosts([
      review(
        costs({
          design: usd(100),
          construction: { amount: 100, currency: 'EUR' },
        }),
      ),
    ]);

    expect(result.data).toEqual({ budget: 200 });
  });

  it('finds no amount in cost fields that are plain numbers', () => {
    const result = mapCosts([
      review(costs({ design: 100, construction: 200 })),
    ]);

    expect(result).toEqual({ data: {} });
  });

  it('adds only the amount of a money field next to a plain number', () => {
    const result = mapCosts([
      review(costs({ design: usd(100), construction: 250 })),
    ]);

    expect(result.data).toEqual({ budget: 100 });
  });

  it('leaves the field empty when a copy rule gives a value and a review has a bad amount', () => {
    const result = mapCosts(
      [
        proposal({ budget: 500 }),
        review(costs({ design: { amount: '500', currency: 'USD' } })),
      ],
      [costTotal, budgetCopy],
    );

    expect(result).toEqual({ data: {} });
  });

  it('copies a plain number as on a mapping without an add rule', () => {
    const result = mapCosts(
      [proposal({ budget: 500 }), review(costs({}))],
      [costTotal, budgetCopy],
    );

    expect(result.data).toEqual({ budget: 500 });
  });

  it('does not read an inherited property', () => {
    const result = mapCosts([
      review({ answers: Object.create({ cost_design: usd(9) }) }),
      review(costs({ design: usd(5) })),
    ]);

    expect(result.data).toEqual({ budget: 5 });
  });
});
