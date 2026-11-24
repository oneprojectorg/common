import { describe, expect, it } from 'vitest';

import { schemaMappingSchema } from './schema';

const mappingWith = (field: { from: unknown; to: string }) => ({
  from: { type: 'proposal', phaseId: 'submission' },
  to: { type: 'proposal', phaseId: 'ballot' },
  fields: [field],
});

describe('schemaMappingSchema', () => {
  it('accepts a nested source path and a single target key', () => {
    const mapping = mappingWith({ from: 'cost.amount', to: 'budget' });

    expect(schemaMappingSchema.safeParse(mapping).success).toBe(true);
  });

  it.each(['budget.amount', '__proto__', 'constructor', ''])(
    'rejects the target key %j',
    (to) => {
      const mapping = mappingWith({ from: 'title', to });

      expect(schemaMappingSchema.safeParse(mapping).success).toBe(false);
    },
  );

  it('rejects a prototype segment in the source path', () => {
    const mapping = mappingWith({
      from: 'cost.__proto__.amount',
      to: 'budget',
    });

    expect(schemaMappingSchema.safeParse(mapping).success).toBe(false);
  });

  it('accepts the sum of source fields', () => {
    const mapping = mappingWith({
      from: {
        operator: 'add',
        operands: [
          { field: 'answers.cost_design.amount' },
          { field: 'answers.cost_construction.amount' },
        ],
      },
      to: 'budget',
    });

    expect(schemaMappingSchema.safeParse(mapping).success).toBe(true);
  });

  it.each([
    { operator: 'add', operands: [] },
    { operator: 'add', operands: [{ field: 'answers.__proto__' }] },
    { operator: 'add', operands: [{ value: 5 }] },
    { operator: 'add', operands: [{ field: 'a', extra: true }] },
    { operator: 'add', operands: [{ field: 'a' }], extra: true },
    { operator: 'subtract', operands: [{ field: 'a' }] },
    { operator: 'multiply', operands: [{ field: 'a' }] },
    {
      operator: 'add',
      operands: [{ operator: 'add', operands: [{ field: 'a' }] }],
    },
  ])('rejects the source %j', (from) => {
    const mapping = mappingWith({ from, to: 'budget' });

    expect(schemaMappingSchema.safeParse(mapping).success).toBe(false);
  });

  it('rejects a nested target key for a sum', () => {
    const mapping = mappingWith({
      from: { operator: 'add', operands: [{ field: 'answers.cost.amount' }] },
      to: 'budget.amount',
    });

    expect(schemaMappingSchema.safeParse(mapping).success).toBe(false);
  });
});
