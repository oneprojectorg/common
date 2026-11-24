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

  const usd = (amount: number) => ({ amount, currency: 'USD' });

  const costs = (answers: {
    design?: unknown;
    construction?: unknown;
    contingency?: unknown;
  }): MappingInput =>
    review({
      answers: {
        ...(answers.design === undefined
          ? {}
          : { cost_design: answers.design }),
        ...(answers.construction === undefined
          ? {}
          : { cost_construction: answers.construction }),
        ...(answers.contingency === undefined
          ? {}
          : { cost_contingency: answers.contingency }),
        __overall_recommendation: 'feasible',
      },
    });

  const mapCosts = (inputs: MappingInput[]) =>
    mapToSchema({ mappings: [costTotal], inputs, targetSchema: targetRef });

  it.each([
    { design: 20000, contingency: 20000, construction: 120000, budget: 160000 },
    { contingency: 3600, construction: 18000, budget: 21600 },
    { construction: 5000, budget: 5000 },
    { design: 0, contingency: 5000, construction: 50000, budget: 55000 },
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
    { design: 0, contingency: 0, construction: 0, budget: 0 },
  ])(
    'fills the total of the cost fields of one review: $budget',
    ({ design, construction, contingency, budget }) => {
      const result = mapCosts([
        costs({
          design: design === undefined ? undefined : usd(design),
          construction:
            construction === undefined ? undefined : usd(construction),
          contingency: contingency === undefined ? undefined : usd(contingency),
        }),
      ]);

      expect(result.data).toEqual({ budget });
    },
  );

  it('leaves the field empty for a review without a cost field', () => {
    expect(mapCosts([costs({})])).toEqual({ data: {} });
  });

  it('skips a review without a cost field and fills the total of the other review', () => {
    const result = mapCosts([
      costs({}),
      costs({
        design: usd(12000),
        contingency: usd(12000),
        construction: usd(60000),
      }),
    ]);

    expect(result.data).toEqual({ budget: 84000 });
  });

  it('leaves the field empty when two reviews give different totals', () => {
    const result = mapCosts([
      costs({ construction: usd(5000) }),
      costs({
        design: usd(0),
        contingency: usd(25000),
        construction: usd(250000),
      }),
    ]);

    expect(result).toEqual({ data: {} });
  });

  it('known limit: counts an amount that is not a number as 0', () => {
    const result = mapCosts([
      costs({
        design: { amount: '1,000', currency: 'USD' },
        construction: usd(100),
      }),
    ]);

    expect(result.data).toEqual({ budget: 100 });
  });

  it('known limit: adds in floating point, so 50322.58 + 289354.84 + 50322.58 is not 390000', () => {
    const result = mapCosts([
      costs({
        design: usd(50322.58),
        construction: usd(289354.84),
        contingency: usd(50322.58),
      }),
    ]);

    expect(result.data).toEqual({ budget: 390000.00000000006 });
  });

  it('known limit: adds the amounts of two currencies as one number', () => {
    const result = mapCosts([
      costs({
        design: usd(100),
        construction: { amount: 100, currency: 'EUR' },
      }),
    ]);

    expect(result.data).toEqual({ budget: 200 });
  });
});
