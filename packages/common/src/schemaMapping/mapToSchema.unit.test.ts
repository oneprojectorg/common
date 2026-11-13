import { describe, expect, it } from 'vitest';

import { mapToSchema } from './mapToSchema';
import type { MappingExpression, MappingInput, SchemaRef } from './types';

const proposalRef: SchemaRef = { type: 'proposal', phaseId: 'submission' };
const reviewRef: SchemaRef = { type: 'review', phaseId: 'feasibility' };
const targetRef: SchemaRef = { type: 'proposal', phaseId: 'ballot' };

const mapOne = ({
  value,
  inputs,
  targetField = 'result',
}: {
  value: MappingExpression;
  inputs: MappingInput[];
  targetField?: string;
}) =>
  mapToSchema({
    rules: [
      {
        sourceSchema: proposalRef,
        targetSchema: targetRef,
        targetField,
        value,
      },
    ],
    inputs,
    targetSchema: targetRef,
  });

const proposal = (data: unknown): MappingInput => ({
  schema: proposalRef,
  data,
});

describe('mapToSchema', () => {
  it('copies a field', () => {
    const result = mapOne({
      value: { field: 'location' },
      inputs: [proposal({ location: { lat: 1, lng: 2 } })],
    });

    expect(result.data).toEqual({ result: { lat: 1, lng: 2 } });
  });

  it('writes a literal', () => {
    const result = mapOne({
      value: { value: 'draft' },
      inputs: [proposal({})],
    });

    expect(result.data).toEqual({ result: 'draft' });
  });

  it('adds three fields', () => {
    const result = mapOne({
      value: {
        operator: 'add',
        operands: [
          { field: 'cost.design' },
          { field: 'cost.build' },
          { field: 'cost.contingency' },
        ],
      },
      inputs: [proposal({ cost: { design: 5, build: 40, contingency: 5 } })],
    });

    expect(result.data).toEqual({ result: 50 });
  });

  it('leaves the field empty when a field it reads is empty', () => {
    const result = mapOne({
      value: { operator: 'add', operands: [{ field: 'a' }, { field: 'b' }] },
      inputs: [proposal({ a: 1, b: '' })],
    });

    expect(result).toEqual({ data: {} });
  });

  it('fills the field when all inputs give equal values', () => {
    const result = mapOne({
      value: { field: 'title' },
      inputs: [proposal({ title: 'Trees' }), proposal({ title: 'Trees' })],
    });

    expect(result.data).toEqual({ result: 'Trees' });
  });

  it('leaves the field empty when inputs give different values', () => {
    const result = mapOne({
      value: { field: 'title' },
      inputs: [proposal({ title: 'Trees' }), proposal({ title: 'Benches' })],
    });

    expect(result).toEqual({ data: {} });
  });

  it('skips inputs of another source schema', () => {
    const result = mapOne({
      value: { field: 'title' },
      inputs: [{ schema: reviewRef, data: { title: 'Trees' } }],
    });

    expect(result).toEqual({ data: {} });
  });

  it('never reads a column of the placeholder proposal row', () => {
    const result = mapOne({
      value: { field: 'id' },
      inputs: [proposal({ title: 'Trees' })],
    });

    expect(result).toEqual({ data: {} });
  });

  it('writes shallower target fields first, whatever the rule order', () => {
    const rule = (targetField: string, field: string) => ({
      sourceSchema: proposalRef,
      targetSchema: targetRef,
      targetField,
      value: { field },
    });
    const result = mapToSchema({
      rules: [rule('location.label', 'label'), rule('location', 'location')],
      inputs: [proposal({ location: { lat: 1 }, label: 'Park' })],
      targetSchema: targetRef,
    });

    expect(result.data).toEqual({ location: { lat: 1, label: 'Park' } });
  });
});
