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
      inputs: [review({ title: 'Trees' })],
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
            { field: 'answers.cost_design' },
            { field: 'answers.cost_construction' },
            { field: 'answers.cost_contingency' },
          ],
        },
        to: 'budget',
      },
    ],
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
    {
      answers: {
        design: usd(20000),
        contingency: usd(20000),
        construction: usd(120000),
      },
      budget: usd(160000),
    },
    {
      answers: { contingency: usd(3600), construction: usd(18000) },
      budget: usd(21600),
    },
    { answers: { construction: usd(5000) }, budget: usd(5000) },
    { answers: { design: usd(500000) }, budget: usd(500000) },
    {
      answers: {
        design: usd(0),
        contingency: usd(5000),
        construction: usd(50000),
      },
      budget: usd(55000),
    },
    {
      answers: {
        design: usd(50322.58),
        contingency: usd(50322.58),
        construction: usd(289354.84),
      },
      budget: usd(390000),
    },
    {
      answers: {
        design: usd(46451.61),
        contingency: usd(46451.61),
        construction: usd(267096.77),
      },
      budget: usd(359999.99),
    },
    {
      answers: {
        design: usd(60387.1),
        contingency: usd(60387.1),
        construction: usd(45290.32),
      },
      budget: usd(166064.52),
    },
    {
      answers: {
        design: usd(10000000),
        contingency: usd(10000000),
        construction: usd(50000000),
      },
      budget: usd(70000000),
    },
  ])(
    'fills the total of the cost fields of one review: $budget.amount',
    ({ answers, budget }) => {
      const result = mapCosts([proposal({}), review(costs(answers))]);

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

    expect(result.data).toEqual({ budget: usd(84000) });
  });

  it('reads a null or empty cost field as missing', () => {
    const result = mapCosts([
      review(costs({ design: null, contingency: '', construction: usd(40) })),
    ]);

    expect(result.data).toEqual({ budget: usd(40) });
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

    expect(result.data).toEqual({ budget: usd(300) });
  });

  it.each([
    {
      name: 'two currencies',
      answers: {
        design: usd(100),
        construction: { amount: 100, currency: 'EUR' },
      },
    },
    {
      name: 'an amount with a thousands separator',
      answers: { design: { amount: '1,000', currency: 'USD' } },
    },
    {
      name: 'an amount with a currency sign',
      answers: { design: { amount: '$500', currency: 'USD' } },
    },
    {
      name: 'a null amount',
      answers: { design: { amount: null, currency: 'USD' } },
    },
    {
      name: 'an extra key',
      answers: { design: { amount: 100, currency: 'USD', note: 'estimate' } },
    },
    {
      name: 'an infinite amount',
      answers: { design: { amount: Infinity, currency: 'USD' } },
    },
    {
      name: 'a plain number next to money',
      answers: { design: usd(100), construction: 250 },
    },
  ])(
    'leaves the field empty for $name, also when another review gives a total',
    ({ answers }) => {
      const result = mapCosts([
        review(costs(answers)),
        review(costs({ construction: usd(100) })),
      ]);

      expect(result).toEqual({ data: {} });
    },
  );

  it('leaves the field empty when a copy rule gives a value and a review has a bad cost', () => {
    const result = mapCosts(
      [
        proposal({ budget: usd(500) }),
        review(costs({ design: usd(100), construction: 250 })),
      ],
      [
        costTotal,
        {
          from: proposalRef,
          to: targetRef,
          fields: [{ from: 'budget', to: 'budget' }],
        },
      ],
    );

    expect(result).toEqual({ data: {} });
  });

  it('does not read an inherited property', () => {
    const result = mapCosts([
      review({ answers: Object.create({ cost_design: usd(9) }) }),
      review(costs({ design: usd(5) })),
    ]);

    expect(result.data).toEqual({ budget: usd(5) });
  });
});
