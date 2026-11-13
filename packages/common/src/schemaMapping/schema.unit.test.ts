import { describe, expect, it } from 'vitest';

import { schemaMappingSchema } from './schema';

const mappingWith = (field: { from: string; to: string }) => ({
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
});
