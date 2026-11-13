import { describe, expect, it } from 'vitest';

import { isRecord } from './fieldPath';
import { mapToSchema } from './mapToSchema';
import type { MappingInput, MappingRule, SchemaRef } from './types';

const proposalRef: SchemaRef = { type: 'proposal', phaseId: 'submission' };
const feasibilityRef: SchemaRef = { type: 'review', phaseId: 'feasibility' };
const equityRef: SchemaRef = { type: 'review', phaseId: 'equity' };
const ballotRef: SchemaRef = { type: 'proposal', phaseId: 'ballot' };

const ballotRules: MappingRule[] = [
  {
    sourceSchema: proposalRef,
    targetSchema: ballotRef,
    targetField: 'title',
    value: { field: 'title' },
  },
  {
    sourceSchema: proposalRef,
    targetSchema: ballotRef,
    targetField: 'description',
    value: { field: 'summary' },
  },
  {
    sourceSchema: proposalRef,
    targetSchema: ballotRef,
    targetField: 'location',
    value: { field: 'location' },
  },
  {
    sourceSchema: proposalRef,
    targetSchema: ballotRef,
    targetField: 'neighborhood',
    value: { field: 'f0a8a062' },
  },
  {
    sourceSchema: feasibilityRef,
    targetSchema: ballotRef,
    targetField: 'budget.amount',
    value: {
      function: 'sum',
      arguments: [
        { field: 'cost_design.amount' },
        { field: 'cost_construction.amount' },
        { field: 'cost_contingency.amount' },
      ],
    },
  },
  {
    sourceSchema: feasibilityRef,
    targetSchema: ballotRef,
    targetField: 'budget.currency',
    value: { field: 'cost_design.currency' },
  },
  {
    sourceSchema: feasibilityRef,
    targetSchema: ballotRef,
    targetField: 'feasibility_recommendation',
    value: { field: '__overall_recommendation' },
  },
  {
    sourceSchema: equityRef,
    targetSchema: ballotRef,
    targetField: 'equity_score',
    value: {
      function: 'sum',
      arguments: [{ field: 'score_need' }, { field: 'score_reach' }],
    },
  },
];

const createProposal = ({
  id,
  title = 'Shade trees for the riverside park',
}: {
  id: string;
  title?: string;
}): MappingInput => ({
  schema: proposalRef,
  id,
  data: {
    title,
    summary: 'Plant forty trees along the walking path.',
    location: { lat: 39.96, lng: -82.99 },
    f0a8a062: 'riverside',
  },
});

const createFeasibilityReview = ({
  id,
  costs = { design: 5000, construction: 40000, contingency: 5000 },
}: {
  id: string;
  costs?: { design?: number; construction: number; contingency: number };
}): MappingInput => ({
  schema: feasibilityRef,
  id,
  data: {
    ...(costs.design === undefined
      ? {}
      : { cost_design: { amount: costs.design, currency: 'USD' } }),
    cost_construction: { amount: costs.construction, currency: 'USD' },
    cost_contingency: { amount: costs.contingency, currency: 'USD' },
    __overall_recommendation: 'feasible',
  },
});

const createEquityReview = ({ id }: { id: string }): MappingInput => ({
  schema: equityRef,
  id,
  data: { score_need: 4, score_reach: 3, __overall_recommendation: 'advance' },
});

describe('mapToSchema', () => {
  it('fills every field from one proposal, one feasibility review and one equity review', () => {
    const result = mapToSchema({
      rules: ballotRules,
      inputs: [
        createProposal({ id: 'proposal-1' }),
        createFeasibilityReview({ id: 'feasibility-1' }),
        createEquityReview({ id: 'equity-1' }),
      ],
      targetSchema: ballotRef,
    });

    expect(result.data).toEqual({
      title: 'Shade trees for the riverside park',
      description: 'Plant forty trees along the walking path.',
      location: { lat: 39.96, lng: -82.99 },
      neighborhood: 'riverside',
      budget: { amount: 50000, currency: 'USD' },
      feasibility_recommendation: 'feasible',
      equity_score: 7,
    });
    expect(result.candidates['budget.amount']).toEqual([
      { value: 50000, sourceId: 'feasibility-1' },
    ]);
  });

  it('leaves the budget empty and keeps both candidates when two feasibility reviews disagree', () => {
    const result = mapToSchema({
      rules: ballotRules,
      inputs: [
        createProposal({ id: 'proposal-1' }),
        createFeasibilityReview({ id: 'feasibility-1' }),
        createFeasibilityReview({
          id: 'feasibility-2',
          costs: { design: 8000, construction: 60000, contingency: 7000 },
        }),
      ],
      targetSchema: ballotRef,
    });

    expect(result.data).toEqual(
      expect.objectContaining({ budget: { currency: 'USD' } }),
    );
    expect(result.candidates['budget.amount']).toEqual([
      { value: 50000, sourceId: 'feasibility-1' },
      { value: 75000, sourceId: 'feasibility-2' },
    ]);
  });

  it('fills the budget when two feasibility reviews reach the same total', () => {
    const result = mapToSchema({
      rules: ballotRules,
      inputs: [
        createFeasibilityReview({ id: 'feasibility-1' }),
        createFeasibilityReview({
          id: 'feasibility-2',
          costs: { design: 10000, construction: 35000, contingency: 5000 },
        }),
      ],
      targetSchema: ballotRef,
    });

    expect(result.data).toEqual({
      budget: { amount: 50000, currency: 'USD' },
      feasibility_recommendation: 'feasible',
    });
  });

  it('keeps three title candidates and leaves the title empty when three proposals combine', () => {
    const result = mapToSchema({
      rules: ballotRules,
      inputs: [
        createProposal({ id: 'proposal-1', title: 'Shade trees' }),
        createProposal({ id: 'proposal-2', title: 'Park benches' }),
        createProposal({ id: 'proposal-3', title: 'Water fountain' }),
        createFeasibilityReview({ id: 'feasibility-1' }),
        createEquityReview({ id: 'equity-1' }),
      ],
      targetSchema: ballotRef,
    });

    expect(result.data).not.toHaveProperty('title');
    expect(result.candidates['title']).toEqual([
      { value: 'Shade trees', sourceId: 'proposal-1' },
      { value: 'Park benches', sourceId: 'proposal-2' },
      { value: 'Water fountain', sourceId: 'proposal-3' },
    ]);
    expect(result.data).toEqual(
      expect.objectContaining({ description: expect.any(String) }),
    );
  });

  it('reads the recommendation only from reviews of the rule source schema', () => {
    const result = mapToSchema({
      rules: ballotRules,
      inputs: [
        createFeasibilityReview({ id: 'feasibility-1' }),
        createEquityReview({ id: 'equity-1' }),
      ],
      targetSchema: ballotRef,
    });

    expect(result.data).toEqual(
      expect.objectContaining({ feasibility_recommendation: 'feasible' }),
    );
    expect(result.candidates['feasibility_recommendation']).toEqual([
      { value: 'feasible', sourceId: 'feasibility-1' },
    ]);
  });

  it('gives no budget candidate when a review is missing one cost, instead of a lower sum', () => {
    const result = mapToSchema({
      rules: ballotRules,
      inputs: [
        createFeasibilityReview({ id: 'feasibility-1' }),
        createFeasibilityReview({
          id: 'feasibility-2',
          costs: { construction: 40000, contingency: 5000 },
        }),
      ],
      targetSchema: ballotRef,
    });

    expect(result.candidates['budget.amount']).toEqual([
      { value: 50000, sourceId: 'feasibility-1' },
    ]);
    expect(result.data).toEqual(
      expect.objectContaining({ budget: { amount: 50000, currency: 'USD' } }),
    );
  });

  it('treats objects with the same keys in a different order as equal', () => {
    const result = mapToSchema({
      rules: ballotRules,
      inputs: [
        createProposal({ id: 'proposal-1' }),
        {
          schema: proposalRef,
          id: 'proposal-2',
          data: {
            location: { lng: -82.99, lat: 39.96 },
          },
        },
      ],
      targetSchema: ballotRef,
    });

    expect(result.candidates['location']).toHaveLength(2);
    expect(result.data).toEqual(
      expect.objectContaining({ location: { lat: 39.96, lng: -82.99 } }),
    );
  });

  it('ignores rules for another target schema', () => {
    const result = mapToSchema({
      rules: [
        ...ballotRules,
        {
          sourceSchema: proposalRef,
          targetSchema: { type: 'proposal', phaseId: 'shortlist' },
          targetField: 'shortlist_title',
          value: { field: 'title' },
        },
      ],
      inputs: [createProposal({ id: 'proposal-1' })],
      targetSchema: ballotRef,
    });

    expect(result.data).not.toHaveProperty('shortlist_title');
    expect(result.candidates).not.toHaveProperty(['shortlist_title']);
  });

  it('gives the same data whatever the rule order, including nested and parent fields', () => {
    const rules: MappingRule[] = [
      ...ballotRules,
      {
        sourceSchema: proposalRef,
        targetSchema: ballotRef,
        targetField: 'location.label',
        value: { field: 'f0a8a062' },
      },
    ];
    const inputs = [
      createProposal({ id: 'proposal-1' }),
      createFeasibilityReview({ id: 'feasibility-1' }),
      createEquityReview({ id: 'equity-1' }),
    ];

    const forward = mapToSchema({ rules, inputs, targetSchema: ballotRef });
    const reversed = mapToSchema({
      rules: [...rules].reverse(),
      inputs,
      targetSchema: ballotRef,
    });

    expect(forward.data).toEqual(reversed.data);
    expect(forward.data).toEqual(
      expect.objectContaining({
        location: { lat: 39.96, lng: -82.99, label: 'riverside' },
      }),
    );
  });

  it('collects candidates from every rule that writes the same target field', () => {
    const result = mapToSchema({
      rules: [
        {
          sourceSchema: proposalRef,
          targetSchema: ballotRef,
          targetField: 'title',
          value: { field: 'title' },
        },
        {
          sourceSchema: feasibilityRef,
          targetSchema: ballotRef,
          targetField: 'title',
          value: { value: 'Reviewed project' },
        },
      ],
      inputs: [
        createProposal({ id: 'proposal-1' }),
        createFeasibilityReview({ id: 'feasibility-1' }),
      ],
      targetSchema: ballotRef,
    });

    expect(result.data).toEqual({});
    expect(result.candidates['title']).toEqual([
      { value: 'Shade trees for the riverside park', sourceId: 'proposal-1' },
      { value: 'Reviewed project', sourceId: 'feasibility-1' },
    ]);
  });

  it('does not mutate its inputs or share objects with them', () => {
    const inputs = [
      createProposal({ id: 'proposal-1' }),
      createFeasibilityReview({ id: 'feasibility-1' }),
    ];
    const rules = [...ballotRules];
    const inputsBefore = structuredClone(inputs);
    const rulesBefore = structuredClone(rules);

    const result = mapToSchema({ rules, inputs, targetSchema: ballotRef });
    const location = result.data.location;
    expect(isRecord(location)).toBe(true);
    if (isRecord(location)) {
      location.lat = 0;
    }

    expect(inputs).toEqual(inputsBefore);
    expect(rules).toEqual(rulesBefore);
    expect(result.candidates['location']).toEqual([
      { value: { lat: 39.96, lng: -82.99 }, sourceId: 'proposal-1' },
    ]);
  });
});

describe('mapToSchema with the selection pipeline evaluator', () => {
  const mapOne = ({
    value,
    data,
    targetField = 'result',
  }: {
    value: MappingRule['value'];
    data: unknown;
    targetField?: string;
  }) =>
    mapToSchema({
      rules: [
        {
          sourceSchema: proposalRef,
          targetSchema: ballotRef,
          targetField,
          value,
        },
      ],
      inputs: [{ schema: proposalRef, id: 'proposal-1', data }],
      targetSchema: ballotRef,
    });

  it('never reads a column of the placeholder proposal row', () => {
    for (const field of ['id', 'status', 'proposalData', 'visibility']) {
      const result = mapOne({ value: { field }, data: { title: 'Trees' } });

      expect(result.candidates).toEqual({});
    }
    expect(
      mapOne({ value: { field: 'id' }, data: { id: 'form-id' } }).data,
    ).toEqual({ result: 'form-id' });
  });

  it('gives no candidate when a field the rule reads is missing, null or empty', () => {
    const value = {
      operator: 'add' as const,
      operands: [{ field: 'a' }, { field: 'b' }],
    };

    for (const data of [{ a: 1 }, { a: 1, b: null }, { a: 1, b: '' }]) {
      expect(mapOne({ value, data }).candidates).toEqual({});
    }
    expect(mapOne({ value, data: { a: 1, b: 2 } }).data).toEqual({
      result: 3,
    });
  });

  it('falls back through coalesce when a direct field argument is missing', () => {
    const result = mapOne({
      value: {
        function: 'coalesce',
        arguments: [{ field: 'nickname' }, { field: 'title' }],
      },
      data: { title: 'Trees' },
    });

    expect(result.data).toEqual({ result: 'Trees' });
  });

  it('gives no candidate when a field nested deeper inside coalesce is missing', () => {
    const result = mapOne({
      value: {
        function: 'coalesce',
        arguments: [
          { operator: 'add', operands: [{ field: 'missing' }, { value: 1 }] },
          { value: 5 },
        ],
      },
      data: {},
    });

    expect(result.candidates).toEqual({});
  });

  it('gives no candidate for a division or modulo by zero', () => {
    for (const operator of ['divide', 'modulo'] as const) {
      const result = mapOne({
        value: { operator, operands: [{ field: 'a' }, { field: 'b' }] },
        data: { a: 10, b: 0 },
      });

      expect(result.candidates).toEqual({});
    }
    expect(
      mapOne({
        value: { operator: 'divide', operands: [{ field: 'a' }, { value: 4 }] },
        data: { a: 10 },
      }).data,
    ).toEqual({ result: 2.5 });
  });

  it('gives no candidate for an empty or non-finite result', () => {
    expect(
      mapOne({
        value: { function: 'trim', arguments: [{ field: 'a' }] },
        data: { a: '   ' },
      }).candidates,
    ).toEqual({});
    expect(
      mapOne({
        value: { function: 'min', arguments: [{ field: 'a' }] },
        data: { a: 'text' },
      }).candidates,
    ).toEqual({});
    expect(mapOne({ value: { value: null }, data: {} }).candidates).toEqual({});
  });

  it('evaluates comparisons, logic and if', () => {
    const result = mapOne({
      value: {
        function: 'if',
        arguments: [
          {
            and: [
              {
                operator: 'greaterThan',
                left: { field: 'score' },
                right: { value: 3 },
              },
              { not: { field: 'withdrawn' } },
            ],
          },
          { value: 'advance' },
          { value: 'hold' },
        ],
      },
      data: { score: 4, withdrawn: false },
    });

    expect(result.data).toEqual({ result: 'advance' });
  });

  it('does not replace a filled value that is not an object with a deeper field', () => {
    const result = mapToSchema({
      rules: [
        {
          sourceSchema: proposalRef,
          targetSchema: ballotRef,
          targetField: 'budget.amount',
          value: { value: 5 },
        },
        {
          sourceSchema: proposalRef,
          targetSchema: ballotRef,
          targetField: 'budget',
          value: { value: 'unknown' },
        },
      ],
      inputs: [{ schema: proposalRef, id: 'proposal-1', data: {} }],
      targetSchema: ballotRef,
    });

    expect(result.data).toEqual({ budget: 'unknown' });
    expect(result.candidates['budget.amount']).toEqual([
      { value: 5, sourceId: 'proposal-1' },
    ]);
  });
});
