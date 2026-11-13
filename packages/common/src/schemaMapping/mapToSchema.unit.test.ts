import { describe, expect, it } from 'vitest';

import { isRecord } from './jsonPointer';
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
    targetPointer: '/title',
    value: { pointer: '/title' },
  },
  {
    sourceSchema: proposalRef,
    targetSchema: ballotRef,
    targetPointer: '/description',
    value: { pointer: '/summary' },
  },
  {
    sourceSchema: proposalRef,
    targetSchema: ballotRef,
    targetPointer: '/location',
    value: { pointer: '/location' },
  },
  {
    sourceSchema: proposalRef,
    targetSchema: ballotRef,
    targetPointer: '/neighborhood',
    value: { pointer: '/f0a8a062' },
  },
  {
    sourceSchema: feasibilityRef,
    targetSchema: ballotRef,
    targetPointer: '/budget/amount',
    value: {
      function: 'sum',
      arguments: [
        { pointer: '/cost_design/amount' },
        { pointer: '/cost_construction/amount' },
        { pointer: '/cost_contingency/amount' },
      ],
    },
  },
  {
    sourceSchema: feasibilityRef,
    targetSchema: ballotRef,
    targetPointer: '/budget/currency',
    value: { pointer: '/cost_design/currency' },
  },
  {
    sourceSchema: feasibilityRef,
    targetSchema: ballotRef,
    targetPointer: '/feasibility_recommendation',
    value: { pointer: '/__overall_recommendation' },
  },
  {
    sourceSchema: equityRef,
    targetSchema: ballotRef,
    targetPointer: '/equity_score',
    value: {
      function: 'sum',
      arguments: [{ pointer: '/score_need' }, { pointer: '/score_reach' }],
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
    expect(result.candidates['/budget/amount']).toEqual([
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
    expect(result.candidates['/budget/amount']).toEqual([
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
    expect(result.candidates['/title']).toEqual([
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
    expect(result.candidates['/feasibility_recommendation']).toEqual([
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

    expect(result.candidates['/budget/amount']).toEqual([
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

    expect(result.candidates['/location']).toHaveLength(2);
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
          targetPointer: '/shortlist_title',
          value: { pointer: '/title' },
        },
      ],
      inputs: [createProposal({ id: 'proposal-1' })],
      targetSchema: ballotRef,
    });

    expect(result.data).not.toHaveProperty('shortlist_title');
    expect(result.candidates).not.toHaveProperty('/shortlist_title');
  });

  it('gives the same data whatever the rule order, including nested and parent pointers', () => {
    const rules: MappingRule[] = [
      ...ballotRules,
      {
        sourceSchema: proposalRef,
        targetSchema: ballotRef,
        targetPointer: '/location/label',
        value: { pointer: '/f0a8a062' },
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

  it('collects candidates from every rule that writes the same target pointer', () => {
    const result = mapToSchema({
      rules: [
        {
          sourceSchema: proposalRef,
          targetSchema: ballotRef,
          targetPointer: '/title',
          value: { pointer: '/title' },
        },
        {
          sourceSchema: feasibilityRef,
          targetSchema: ballotRef,
          targetPointer: '/title',
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
    expect(result.candidates['/title']).toEqual([
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
    expect(result.candidates['/location']).toEqual([
      { value: { lat: 39.96, lng: -82.99 }, sourceId: 'proposal-1' },
    ]);
  });
});
