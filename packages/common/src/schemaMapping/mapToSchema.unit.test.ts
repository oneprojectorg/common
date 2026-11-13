import { describe, expect, it } from 'vitest';

import { mapToSchema } from './mapToSchema';
import type { FieldMapping, MappingInput, SchemaRef } from './schema';

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
});
