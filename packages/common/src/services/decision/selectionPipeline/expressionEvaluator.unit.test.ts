import { describe, expect, it } from 'vitest';

import { evaluateExpression } from './expressionEvaluator';
import type {
  ArithmeticExpression,
  ComparisonExpression,
  Expression,
  ExpressionContext,
} from './types';

const context = (): ExpressionContext => ({
  record: {},
  variables: {},
  outputs: {},
});

describe('evaluateExpression function calls', () => {
  const call = (name: string, ...values: unknown[]): Expression => ({
    function: name,
    arguments: values.map((value) => ({ value })),
  });

  it.each([
    { name: 'sum', args: [1, 'x', 2], result: 3 },
    { name: 'avg', args: [1, 'x', 5], result: 2 },
    { name: 'avg', args: [], result: 0 },
    { name: 'count', args: [1, null], result: 2 },
    { name: 'min', args: [3, 'x', 1], result: 1 },
    { name: 'max', args: [3, 'x', 1], result: 3 },
    { name: 'if', args: [true, 'a', 'b'], result: 'a' },
    { name: 'if', args: [0, 'a', 'b'], result: 'b' },
    { name: 'coalesce', args: [null, undefined, 'a'], result: 'a' },
    { name: 'coalesce', args: [null], result: null },
    { name: 'concat', args: ['a', 1], result: 'a1' },
    { name: 'length', args: ['abc'], result: 3 },
    { name: 'length', args: [[1, 2]], result: 2 },
    { name: 'length', args: [5], result: 0 },
    { name: 'length', args: [], result: 0 },
    { name: 'abs', args: [-2], result: 2 },
    { name: 'abs', args: ['x'], result: 0 },
    { name: 'round', args: [1.5], result: 2 },
    { name: 'round', args: [], result: 0 },
    { name: 'floor', args: [1.5], result: 1 },
    { name: 'floor', args: ['x'], result: 0 },
    { name: 'ceil', args: [1.2], result: 2 },
    { name: 'ceil', args: ['x'], result: 0 },
    { name: 'toLowerCase', args: ['AB'], result: 'ab' },
    { name: 'toLowerCase', args: [1], result: '' },
    { name: 'toUpperCase', args: ['ab'], result: 'AB' },
    { name: 'toUpperCase', args: [1], result: '' },
    { name: 'trim', args: [' a '], result: 'a' },
    { name: 'trim', args: [1], result: '' },
  ])('$name of $args gives $result', ({ name, args, result }) => {
    expect(evaluateExpression(call(name, ...args), context())).toEqual(result);
  });

  it('throws for an if without three arguments', () => {
    expect(() => evaluateExpression(call('if', true), context())).toThrow(
      'if function requires 3 arguments',
    );
  });

  it('throws for an unknown function', () => {
    expect(() => evaluateExpression(call('unknown'), context())).toThrow(
      'Unknown function: unknown',
    );
  });
});

describe('evaluateExpression comparisons and logic', () => {
  const compare = (
    operator: ComparisonExpression['operator'],
    left: unknown,
    right: unknown,
  ): Expression => ({
    operator,
    left: { value: left },
    right: { value: right },
  });

  it.each<{
    operator: ComparisonExpression['operator'];
    left: unknown;
    right: unknown;
    result: boolean;
  }>([
    { operator: 'equals', left: 1, right: 1, result: true },
    { operator: 'notEquals', left: 1, right: 2, result: true },
    { operator: 'greaterThan', left: 2, right: 1, result: true },
    { operator: 'lessThan', left: 2, right: 1, result: false },
    { operator: 'greaterThanOrEquals', left: 1, right: 1, result: true },
    { operator: 'lessThanOrEquals', left: 2, right: 1, result: false },
    { operator: 'in', left: 1, right: [1, 2], result: true },
    { operator: 'in', left: 1, right: 'x', result: false },
    { operator: 'notIn', left: 3, right: [1, 2], result: true },
    { operator: 'notIn', left: 3, right: 'x', result: false },
    { operator: 'contains', left: 'abc', right: 'b', result: true },
    { operator: 'contains', left: [1, 2], right: 2, result: true },
    { operator: 'contains', left: 5, right: 5, result: false },
    { operator: 'startsWith', left: 'abc', right: 'a', result: true },
    { operator: 'startsWith', left: 1, right: 'a', result: false },
    { operator: 'endsWith', left: 'abc', right: 'c', result: true },
    { operator: 'endsWith', left: 1, right: 'c', result: false },
    { operator: 'matches', left: 'abc', right: '^a', result: true },
    { operator: 'matches', left: 'abc', right: '(a+)+$', result: false },
    { operator: 'matches', left: 'abc', right: '[', result: false },
    { operator: 'matches', left: 1, right: '^a', result: false },
  ])(
    '$left $operator $right gives $result',
    ({ operator, left, right, result }) => {
      expect(
        evaluateExpression(compare(operator, left, right), context()),
      ).toBe(result);
    },
  );

  it.each([
    { expression: { and: [{ value: true }, { value: 1 }] }, result: true },
    { expression: { or: [{ value: false }, { value: 0 }] }, result: false },
    { expression: { not: { value: false } }, result: true },
  ])('evaluates $expression to $result', ({ expression, result }) => {
    expect(evaluateExpression(expression, context())).toBe(result);
  });

  it('reads a variable, then an output, and gives null for neither', () => {
    const variableContext: ExpressionContext = {
      record: {},
      variables: { threshold: 3 },
      outputs: { total: 7 },
    };

    expect(
      [
        { variable: '$threshold' },
        { variable: 'total' },
        { variable: 'x' },
      ].map((expression) => evaluateExpression(expression, variableContext)),
    ).toEqual([3, 7, null]);
  });

  it.each<{
    operator: ArithmeticExpression['operator'];
    operands: number[];
    result: number;
  }>([
    { operator: 'subtract', operands: [10, 3, 2], result: 5 },
    { operator: 'multiply', operands: [2, 3], result: 6 },
    { operator: 'divide', operands: [12, 3, 2], result: 2 },
    { operator: 'divide', operands: [6, 0], result: 0 },
    { operator: 'modulo', operands: [7, 4], result: 3 },
    { operator: 'modulo', operands: [7, 0], result: 0 },
    { operator: 'power', operands: [2, 3], result: 8 },
  ])(
    '$operator of $operands gives $result',
    ({ operator, operands, result }) => {
      const expression: Expression = {
        operator,
        operands: operands.map((value) => ({ value })),
      };

      expect(evaluateExpression(expression, context())).toBe(result);
    },
  );
});
