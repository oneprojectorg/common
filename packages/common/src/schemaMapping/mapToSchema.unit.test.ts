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

const proposal = (id: string, data: unknown): MappingInput => ({
  schema: proposalRef,
  id,
  data,
});

describe('mapToSchema', () => {
  it('copies a field', () => {
    const result = mapOne({
      value: { field: 'location' },
      inputs: [proposal('p1', { location: { lat: 1, lng: 2 } })],
    });

    expect(result.data).toEqual({ result: { lat: 1, lng: 2 } });
  });

  it('writes a literal', () => {
    const result = mapOne({
      value: { value: 'draft' },
      inputs: [proposal('p1', {})],
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
      inputs: [
        proposal('p1', { cost: { design: 5, build: 40, contingency: 5 } }),
      ],
    });

    expect(result.data).toEqual({ result: 50 });
  });

  it('gives no candidate when a field it reads is empty', () => {
    const result = mapOne({
      value: { operator: 'add', operands: [{ field: 'a' }, { field: 'b' }] },
      inputs: [proposal('p1', { a: 1, b: '' })],
    });

    expect(result).toEqual({ data: {}, candidates: {} });
  });

  it('fills the field when all candidates are equal', () => {
    const result = mapOne({
      value: { field: 'title' },
      inputs: [
        proposal('p1', { title: 'Trees' }),
        proposal('p2', { title: 'Trees' }),
      ],
    });

    expect(result.data).toEqual({ result: 'Trees' });
  });

  it('leaves the field empty and lists both candidates when they differ', () => {
    const result = mapOne({
      value: { field: 'title' },
      inputs: [
        proposal('p1', { title: 'Trees' }),
        proposal('p2', { title: 'Benches' }),
      ],
    });

    expect(result).toEqual({
      data: {},
      candidates: {
        result: [
          { value: 'Trees', sourceId: 'p1' },
          { value: 'Benches', sourceId: 'p2' },
        ],
      },
    });
  });

  it('skips inputs of another source schema', () => {
    const result = mapOne({
      value: { field: 'title' },
      inputs: [{ schema: reviewRef, id: 'r1', data: { title: 'Trees' } }],
    });

    expect(result.candidates).toEqual({});
  });

  it('never reads a column of the placeholder proposal row', () => {
    const result = mapOne({
      value: { field: 'id' },
      inputs: [proposal('p1', { title: 'Trees' })],
    });

    expect(result.candidates).toEqual({});
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
      inputs: [proposal('p1', { location: { lat: 1 }, label: 'Park' })],
      targetSchema: targetRef,
    });

    expect(result.data).toEqual({ location: { lat: 1, label: 'Park' } });
  });
});
