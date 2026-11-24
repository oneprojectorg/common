import { describe, expect, it } from 'vitest';

import type { ValueType } from '../../../valueTypes/valueType';
import { evaluateExpression } from './expressionEvaluator';
import type {
  ArithmeticExpression,
  Expression,
  ExpressionContext,
} from './types';

type Length = { meters: number };

const isLength = (value: unknown): value is Length =>
  typeof value === 'object' &&
  value !== null &&
  'meters' in value &&
  typeof value.meters === 'number';

const lengthType: ValueType<Length> = {
  parse: (value) => (isLength(value) ? { meters: value.meters } : undefined),
  add: (a, b) => {
    const meters = a.meters + b.meters;
    return meters > 1000 ? undefined : { meters };
  },
};

const add = (...values: unknown[]): Expression => ({
  operator: 'add',
  operands: values.map((value) => ({ value })),
});

const context = (valueTypes?: ValueType<unknown>[]): ExpressionContext => ({
  record: {},
  variables: {},
  outputs: {},
  ...(valueTypes ? { valueTypes } : {}),
});

describe('evaluateExpression add', () => {
  it('adds numbers and reads any other operand as 0 without value types', () => {
    expect(evaluateExpression(add(1, 2.5, 'x', null), context())).toBe(3.5);
  });

  it('adds numbers as before when value types are given', () => {
    expect(evaluateExpression(add(1, 2.5), context([lengthType]))).toBe(3.5);
  });

  it('adds the values of the one type that accepts every operand', () => {
    const result = evaluateExpression(
      add({ meters: 2 }, { meters: 3 }, { meters: 5 }),
      context([lengthType]),
    );

    expect(result).toEqual({ meters: 10 });
  });

  it('skips a missing operand', () => {
    const result = evaluateExpression(
      add({ meters: 2 }, null, undefined, { meters: 3 }),
      context([lengthType]),
    );

    expect(result).toEqual({ meters: 5 });
  });

  it.each([
    { name: 'a number next to a typed value', operands: [{ meters: 2 }, 3] },
    { name: 'a value no type accepts', operands: [{ meters: 2 }, 'x'] },
    { name: 'no present operand', operands: [null, undefined] },
    {
      name: 'an add the type refuses',
      operands: [{ meters: 900 }, { meters: 200 }],
    },
  ])('gives null for $name', ({ operands }) => {
    expect(
      evaluateExpression(add(...operands), context([lengthType])),
    ).toBeNull();
  });

  it('gives null when two types accept the operands', () => {
    expect(
      evaluateExpression(
        add({ meters: 2 }, { meters: 3 }),
        context([lengthType, lengthType]),
      ),
    ).toBeNull();
  });

  it('keeps the other operators on numbers when value types are given', () => {
    const result = evaluateExpression(
      {
        operator: 'subtract',
        operands: [{ value: { meters: 5 } }, { value: 2 }],
      },
      context([lengthType]),
    );

    expect(result).toBe(-2);
  });
});

describe('evaluateExpression arithmetic on numbers', () => {
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
