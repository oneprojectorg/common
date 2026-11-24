import { describe, expect, it } from 'vitest';

import { moneyValueType } from '../../../valueTypes/moneyValueType';
import type { ValueType } from '../../../valueTypes/valueType';
import {
  createExpressionEvaluator,
  evaluateExpression,
} from './expressionEvaluator';
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

const lengthWithoutAdd: ValueType<Length> = {
  parse: lengthType.parse,
};

const add = (...values: unknown[]): Expression => ({
  operator: 'add',
  operands: values.map((value) => ({ value })),
});

const usd = (amount: number) => ({ amount, currency: 'USD' });
const eur = (amount: number) => ({ amount, currency: 'EUR' });

const evaluateWithMoney = createExpressionEvaluator({
  valueTypes: [moneyValueType],
});

const context = (): ExpressionContext => ({
  record: {},
  variables: {},
  outputs: {},
});

const evaluateWithLength = createExpressionEvaluator({
  valueTypes: [lengthType],
});

describe('evaluateExpression add', () => {
  it('adds numbers and reads any other operand as 0', () => {
    expect(evaluateExpression(add(1, 2.5, 'x', null), context())).toBe(3.5);
  });

  it('reads a money operand as 0, as it knows no value types', () => {
    expect(evaluateExpression(add(usd(5), usd(2)), context())).toBe(0);
  });

  it('reads a nested add of mixed currencies as 0', () => {
    const result = evaluateExpression(
      { operator: 'add', operands: [add(usd(5), eur(2)), { value: 3 }] },
      context(),
    );

    expect(result).toBe(3);
  });
});

describe('createExpressionEvaluator add', () => {
  it('adds numbers as evaluateExpression does', () => {
    expect(evaluateWithLength(add(1, 2.5), context())).toBe(3.5);
  });

  it('adds the values of the one type that accepts every operand', () => {
    const result = evaluateWithLength(
      add({ meters: 2 }, { meters: 3 }, { meters: 5 }),
      context(),
    );

    expect(result).toEqual({ meters: 10 });
  });

  it('adds typed values in a nested expression', () => {
    const result = evaluateWithLength(
      {
        operator: 'add',
        operands: [add({ meters: 2 }, { meters: 3 }), { value: { meters: 4 } }],
      },
      context(),
    );

    expect(result).toEqual({ meters: 9 });
  });

  it('skips a missing operand', () => {
    const result = evaluateWithLength(
      add({ meters: 2 }, null, undefined, { meters: 3 }),
      context(),
    );

    expect(result).toEqual({ meters: 5 });
  });

  it('skips a missing field next to a money value', () => {
    const result = evaluateWithMoney(
      {
        operator: 'add',
        operands: [{ field: 'budget' }, { value: usd(3) }],
      },
      context(),
    );

    expect(result).toEqual(usd(3));
  });

  it('adds the total of a nested money add', () => {
    const result = evaluateWithMoney(
      { operator: 'add', operands: [{ value: usd(3) }, add(usd(5), usd(2))] },
      context(),
    );

    expect(result).toEqual(usd(10));
  });

  it('gives null when a nested add fails, not a partial total', () => {
    const result = evaluateWithMoney(
      { operator: 'add', operands: [{ value: usd(3) }, add(usd(5), eur(2))] },
      context(),
    );

    expect(result).toBeNull();
  });

  it('does not change the context object of the caller', () => {
    const callerContext = context();
    createExpressionEvaluator({ valueTypes: [moneyValueType] })(
      add(usd(5), usd(2)),
      callerContext,
    );

    expect(callerContext).not.toHaveProperty('valueTypes');
  });

  it('keeps the value types in a copied context for a nested add', () => {
    const result = evaluateExpression(
      {
        operator: 'add',
        operands: [add(usd(5), usd(2)), { value: usd(3) }],
      },
      { ...context(), valueTypes: [moneyValueType] },
    );

    expect(result).toEqual(usd(10));
  });

  it.each([
    { name: 'a number next to a typed value', operands: [{ meters: 2 }, 3] },
    { name: 'a value no type accepts', operands: [{ meters: 2 }, 'x'] },
    { name: 'all operands missing', operands: [null, undefined] },
    {
      name: 'an add the type refuses',
      operands: [{ meters: 900 }, { meters: 200 }],
    },
  ])('gives null for $name', ({ operands }) => {
    expect(evaluateWithLength(add(...operands), context())).toBeNull();
  });

  it('gives null when two types accept the operands', () => {
    const evaluate = createExpressionEvaluator({
      valueTypes: [lengthType, lengthWithoutAdd],
    });

    expect(evaluate(add({ meters: 2 }, { meters: 3 }), context())).toBeNull();
  });

  it('gives null for a type without add', () => {
    const evaluate = createExpressionEvaluator({
      valueTypes: [lengthWithoutAdd],
    });

    expect(evaluate(add({ meters: 2 }), context())).toBeNull();
  });

  it('gives null for a number next to a money value', () => {
    const evaluate = createExpressionEvaluator({
      valueTypes: [moneyValueType],
    });

    expect(evaluate(add(usd(5), 2), context())).toBeNull();
  });

  it('gives null for an operator that no value type implements', () => {
    const evaluate = createExpressionEvaluator({
      valueTypes: [moneyValueType],
    });

    const result = evaluate(
      {
        operator: 'subtract',
        operands: [{ value: usd(5) }, { value: usd(2) }],
      },
      context(),
    );

    expect(result).toBeNull();
  });
});

describe('arithmetic on numbers', () => {
  const cases: {
    operator: ArithmeticExpression['operator'];
    operands: number[];
    result: number;
  }[] = [
    { operator: 'add', operands: [1, 2], result: 3 },
    { operator: 'subtract', operands: [10, 3, 2], result: 5 },
    { operator: 'multiply', operands: [2, 3], result: 6 },
    { operator: 'divide', operands: [12, 3, 2], result: 2 },
    { operator: 'divide', operands: [6, 0], result: 0 },
    { operator: 'modulo', operands: [7, 4], result: 3 },
    { operator: 'modulo', operands: [7, 0], result: 0 },
    { operator: 'power', operands: [2, 3], result: 8 },
  ];

  it.each(
    cases.flatMap((testCase) => [
      {
        ...testCase,
        evaluator: 'evaluateExpression',
        evaluate: evaluateExpression,
      },
      {
        ...testCase,
        evaluator: 'an evaluator with money',
        evaluate: createExpressionEvaluator({ valueTypes: [moneyValueType] }),
      },
    ]),
  )(
    '$operator of $operands with $evaluator gives $result',
    ({ operator, operands, result, evaluate }) => {
      const expression: Expression = {
        operator,
        operands: operands.map((value) => ({ value })),
      };

      expect(evaluate(expression, context())).toBe(result);
    },
  );
});
