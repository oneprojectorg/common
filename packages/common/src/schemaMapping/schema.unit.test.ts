import { describe, expect, it } from 'vitest';

import {
  MAX_MAPPING_EXPRESSION_ARGUMENTS,
  MAX_MAPPING_EXPRESSION_DEPTH,
  mappingExpressionSchema,
  mappingRuleSchema,
} from './schema';
import type { MappingExpression } from './types';

const validRule = {
  sourceSchema: { type: 'review', phaseId: 'feasibility' },
  targetSchema: { type: 'proposal', phaseId: 'ballot' },
  targetPointer: '/budget/amount',
  value: {
    function: 'round',
    arguments: [
      {
        function: 'sum',
        arguments: [
          { pointer: '/cost_design/amount' },
          { pointer: '/cost_construction/amount' },
        ],
      },
    ],
  },
};

describe('mappingRuleSchema', () => {
  it('accepts a valid rule', () => {
    expect(mappingRuleSchema.safeParse(validRule).success).toBe(true);
  });

  it('rejects an unknown schema type, an empty target pointer and extra keys', () => {
    for (const rule of [
      { ...validRule, sourceSchema: { type: 'comment', phaseId: 'a' } },
      { ...validRule, targetPointer: '' },
      { ...validRule, targetPointer: 'budget' },
      { ...validRule, targetPointer: '/__proto__/amount' },
      { ...validRule, extra: true },
    ]) {
      expect(mappingRuleSchema.safeParse(rule).success).toBe(false);
    }
  });
});

describe('mappingExpressionSchema', () => {
  it('accepts every node shape', () => {
    for (const expression of [
      { pointer: '' },
      { pointer: '/__overall_recommendation' },
      { value: null },
      { value: 12 },
      { operator: 'divide', operands: [{ pointer: '/a' }, { value: 2 }] },
      { function: 'coalesce', arguments: [{ pointer: '/a' }] },
    ]) {
      expect(mappingExpressionSchema.safeParse(expression).success).toBe(true);
    }
  });

  it('rejects mixed node shapes, bad pointers and bad argument counts', () => {
    for (const expression of [
      { pointer: '/a', value: 1 },
      { operator: 'add', operands: [{ value: 1 }], function: 'sum' },
      { pointer: 'a' },
      { pointer: '/a~2' },
      { pointer: '/constructor' },
      { value: { nested: true } },
      { operator: 'power', operands: [{ value: 1 }, { value: 2 }] },
      { operator: 'add', operands: [{ value: 1 }] },
      { function: 'round', arguments: [{ value: 1 }, { value: 2 }] },
      { function: 'sum', arguments: [] },
      {
        function: 'sum',
        arguments: Array.from(
          { length: MAX_MAPPING_EXPRESSION_ARGUMENTS + 1 },
          () => ({ value: 1 }),
        ),
      },
    ]) {
      expect(mappingExpressionSchema.safeParse(expression).success).toBe(false);
    }
  });

  it('accepts nesting up to the depth limit and rejects one level more', () => {
    expect(
      mappingExpressionSchema.safeParse(
        buildNestedExpression(MAX_MAPPING_EXPRESSION_DEPTH),
      ).success,
    ).toBe(true);
    expect(
      mappingExpressionSchema.safeParse(
        buildNestedExpression(MAX_MAPPING_EXPRESSION_DEPTH + 1),
      ).success,
    ).toBe(false);
  });
});

const buildNestedExpression = (depth: number): MappingExpression => {
  let expression: MappingExpression = { pointer: '/cost' };
  for (let level = 1; level < depth; level++) {
    expression = { function: 'round', arguments: [expression] };
  }
  return expression;
};
