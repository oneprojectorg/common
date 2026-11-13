import { describe, expect, it } from 'vitest';

import type { Expression } from '../services/decision/selectionPipeline/types';
import {
  MAX_MAPPING_EXPRESSION_ARGUMENTS,
  MAX_MAPPING_EXPRESSION_DEPTH,
  mappingExpressionSchema,
  mappingRuleSchema,
} from './schema';

const validRule = {
  sourceSchema: { type: 'review', phaseId: 'feasibility' },
  targetSchema: { type: 'proposal', phaseId: 'ballot' },
  targetField: 'budget.amount',
  value: {
    function: 'round',
    arguments: [
      {
        function: 'sum',
        arguments: [
          { field: 'cost_design.amount' },
          { field: 'cost_construction.amount' },
        ],
      },
    ],
  },
};

describe('mappingRuleSchema', () => {
  it('accepts a valid rule', () => {
    expect(mappingRuleSchema.safeParse(validRule).success).toBe(true);
  });

  it('rejects an unknown schema type, a bad target field and extra keys', () => {
    for (const rule of [
      { ...validRule, sourceSchema: { type: 'comment', phaseId: 'a' } },
      { ...validRule, targetField: '' },
      { ...validRule, targetField: 'budget..amount' },
      { ...validRule, targetField: '__proto__.amount' },
      { ...validRule, targetPointer: '/budget/amount' },
      { ...validRule, extra: true },
    ]) {
      expect(mappingRuleSchema.safeParse(rule).success).toBe(false);
    }
  });
});

describe('mappingExpressionSchema', () => {
  it('accepts every node shape', () => {
    for (const expression of [
      { field: '__overall_recommendation' },
      { field: 'attachments.0' },
      { value: null },
      { value: 12 },
      { value: ['a', 'b'] },
      { operator: 'divide', operands: [{ field: 'a' }, { value: 2 }] },
      { operator: 'modulo', operands: [{ field: 'a' }, { value: 2 }] },
      { operator: 'in', left: { field: 'a' }, right: { value: ['x', 'y'] } },
      { and: [{ field: 'a' }] },
      { or: [{ field: 'a' }, { field: 'b' }] },
      { not: { field: 'a' } },
      { function: 'coalesce', arguments: [{ field: 'a' }] },
      {
        function: 'if',
        arguments: [{ field: 'a' }, { value: 1 }, { value: 2 }],
      },
    ]) {
      expect(mappingExpressionSchema.safeParse(expression).success).toBe(true);
    }
  });

  it('rejects variables, unknown functions, mixed shapes, bad paths and bad argument counts', () => {
    for (const expression of [
      { variable: '$threshold' },
      { function: 'median', arguments: [{ value: 1 }] },
      { field: 'a', value: 1 },
      { operator: 'add', operands: [{ value: 1 }], function: 'sum' },
      { and: [{ field: 'a' }], or: [{ field: 'b' }] },
      { and: [] },
      { field: '' },
      { field: 'a..b' },
      { field: 'constructor' },
      { value: { nested: true } },
      { operator: 'between', left: { value: 1 }, right: { value: 2 } },
      { operator: 'add', operands: [{ value: 1 }] },
      { function: 'if', arguments: [{ value: true }, { value: 1 }] },
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

const buildNestedExpression = (depth: number): Expression => {
  let expression: Expression = { field: 'cost' };
  for (let level = 1; level < depth; level++) {
    expression = { function: 'round', arguments: [expression] };
  }
  return expression;
};
