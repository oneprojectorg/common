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

const proposal = (data: unknown, sourceId = 'garden'): MappingInput => ({
  schema: proposalRef,
  data,
  sourceId,
});

const review = (data: unknown, sourceId = 'garden'): MappingInput => ({
  schema: reviewRef,
  data,
  sourceId,
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

describe('mapToSchema with a moneySum rule', () => {
  const costSum: SchemaMapping = {
    from: reviewRef,
    to: targetRef,
    fields: [
      {
        from: {
          moneySum: [
            'answers.cost_design',
            'answers.cost_construction',
            'answers.cost_contingency',
          ],
        },
        to: 'budget',
      },
    ],
  };

  const usd = (amount: number) => ({ amount, currency: 'USD' });

  const costs = (answers: Record<string, unknown>) => ({ answers });

  const mapCosts = (
    inputs: MappingInput[],
    mappings: SchemaMapping[] = [costSum],
  ) => mapToSchema({ mappings, inputs, targetSchema: targetRef });

  it('fills the sum of the fields of one review as a money value', () => {
    const result = mapCosts([
      proposal({}),
      review(
        costs({
          cost_design: usd(1000),
          cost_construction: usd(20000),
          cost_contingency: usd(500),
        }),
      ),
    ]);

    expect(result.data).toEqual({ budget: usd(21500) });
  });

  it('fills the total when two reviews of a proposal give equal totals', () => {
    const result = mapCosts([
      review(costs({ cost_design: usd(100), cost_construction: usd(200) })),
      review(costs({ cost_design: usd(200), cost_construction: usd(100) })),
    ]);

    expect(result.data).toEqual({ budget: usd(300) });
  });

  it('leaves the field empty when two reviews of a proposal give different totals', () => {
    const result = mapCosts([
      review(costs({ cost_design: usd(100) })),
      review(costs({ cost_design: usd(900) })),
    ]);

    expect(result).toEqual({ data: {} });
  });

  it('leaves the field empty when a proposal has no review', () => {
    const result = mapCosts([proposal({ title: 'Trees' })]);

    expect(result).toEqual({ data: {} });
  });

  it('ignores a missing or null field and sums the others', () => {
    const result = mapCosts([
      review(costs({ cost_design: usd(100), cost_contingency: null })),
    ]);

    expect(result.data).toEqual({ budget: usd(100) });
  });

  it('gives no total for a review without any of the fields, and uses the other review', () => {
    const result = mapCosts([
      review(costs({ cost_design: null })),
      review(costs({ cost_construction: usd(40) })),
    ]);

    expect(result.data).toEqual({ budget: usd(40) });
  });

  it('leaves the field empty when no review has any of the fields', () => {
    const result = mapCosts([review(costs({ other: usd(10) }))]);

    expect(result).toEqual({ data: {} });
  });

  it('adds the totals of the proposals of a merged entry', () => {
    const result = mapCosts([
      proposal({}, 'garden'),
      proposal({}, 'benches'),
      review(costs({ cost_design: usd(100) }), 'garden'),
      review(
        costs({ cost_design: usd(50), cost_contingency: usd(5) }),
        'benches',
      ),
    ]);

    expect(result.data).toEqual({ budget: usd(155) });
  });

  it('leaves the field empty when one proposal of a merged entry has no total', () => {
    const result = mapCosts([
      proposal({}, 'garden'),
      proposal({}, 'benches'),
      review(costs({ cost_design: usd(100) }), 'garden'),
    ]);

    expect(result).toEqual({ data: {} });
  });

  it('leaves the field empty when one proposal of a merged entry has reviews that disagree', () => {
    const result = mapCosts([
      review(costs({ cost_design: usd(100) }), 'garden'),
      review(costs({ cost_design: usd(70) }), 'benches'),
      review(costs({ cost_design: usd(80) }), 'benches'),
    ]);

    expect(result).toEqual({ data: {} });
  });

  it('leaves the field empty when the fields of one review have mixed currencies', () => {
    const result = mapCosts([
      review(
        costs({
          cost_design: usd(100),
          cost_construction: { amount: 100, currency: 'EUR' },
        }),
      ),
    ]);

    expect(result).toEqual({ data: {} });
  });

  it('leaves the field empty when the proposals of a merged entry have mixed currencies', () => {
    const result = mapCosts([
      review(costs({ cost_design: usd(100) }), 'garden'),
      review(
        costs({ cost_design: { amount: 100, currency: 'EUR' } }),
        'benches',
      ),
    ]);

    expect(result).toEqual({ data: {} });
  });

  it.each([0, -10])('leaves the field empty for a total of %d', (amount) => {
    const result = mapCosts([review(costs({ cost_design: usd(amount) }))]);

    expect(result).toEqual({ data: {} });
  });

  it('leaves the field empty when a field holds a value that is not money', () => {
    const result = mapCosts([
      review(costs({ cost_design: usd(100), cost_construction: 250 })),
    ]);

    expect(result).toEqual({ data: {} });
  });

  it('adds decimal amounts at the precision of the inputs', () => {
    const result = mapCosts([
      review(costs({ cost_design: usd(0.1), cost_construction: usd(0.2) })),
    ]);

    expect(result.data).toEqual({ budget: usd(0.3) });
  });

  it('does not read an inherited property', () => {
    const result = mapCosts([
      review({ answers: { cost_design: usd(5) } }),
      review({ answers: Object.create({ cost_design: usd(9) }) }),
    ]);

    expect(result.data).toEqual({ budget: usd(5) });
  });

  it('leaves the field empty when the sum gives no total and a copy rule gives a value', () => {
    const result = mapCosts(
      [proposal({ budget: usd(500) })],
      [
        costSum,
        {
          from: proposalRef,
          to: targetRef,
          fields: [{ from: 'budget', to: 'budget' }],
        },
      ],
    );

    expect(result).toEqual({ data: {} });
  });
});
