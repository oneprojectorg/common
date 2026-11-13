import { describe, expect, it } from 'vitest';

import { evaluateMappingExpression } from './evaluateMappingExpression';

const data = {
  title: 'Park benches',
  empty: '',
  nothing: null,
  label: 'Ward',
  ward: 7,
  cost: 1234.5,
  zero: 0,
  quantity: 3,
  flag: true,
};

describe('evaluateMappingExpression', () => {
  it('gives no value for a pointer that is missing, null or an empty string', () => {
    expect(
      evaluateMappingExpression({ expression: { pointer: '/title' }, data }),
    ).toBe('Park benches');
    for (const pointer of ['/missing', '/nothing', '/empty']) {
      expect(
        evaluateMappingExpression({ expression: { pointer }, data }),
      ).toBeUndefined();
    }
  });

  it('returns a literal as written', () => {
    expect(
      evaluateMappingExpression({ expression: { value: 'USD' }, data }),
    ).toBe('USD');
  });

  it('applies arithmetic and gives no value when an operand is missing or not a number', () => {
    expect(
      evaluateMappingExpression({
        expression: {
          operator: 'multiply',
          operands: [{ pointer: '/cost' }, { pointer: '/quantity' }],
        },
        data,
      }),
    ).toBe(3703.5);
    expect(
      evaluateMappingExpression({
        expression: {
          operator: 'subtract',
          operands: [{ pointer: '/cost' }, { value: 234.5 }],
        },
        data,
      }),
    ).toBe(1000);
    expect(
      evaluateMappingExpression({
        expression: {
          operator: 'add',
          operands: [{ pointer: '/cost' }, { pointer: '/missing' }],
        },
        data,
      }),
    ).toBeUndefined();
    expect(
      evaluateMappingExpression({
        expression: {
          operator: 'add',
          operands: [{ pointer: '/cost' }, { pointer: '/title' }],
        },
        data,
      }),
    ).toBeUndefined();
  });

  it('gives no value when dividing by zero', () => {
    expect(
      evaluateMappingExpression({
        expression: {
          operator: 'divide',
          operands: [{ pointer: '/cost' }, { pointer: '/zero' }],
        },
        data,
      }),
    ).toBeUndefined();
    expect(
      evaluateMappingExpression({
        expression: {
          operator: 'divide',
          operands: [{ value: 9 }, { pointer: '/quantity' }],
        },
        data,
      }),
    ).toBe(3);
  });

  it('rounds one number to an integer', () => {
    expect(
      evaluateMappingExpression({
        expression: { function: 'round', arguments: [{ pointer: '/cost' }] },
        data,
      }),
    ).toBe(1235);
    expect(
      evaluateMappingExpression({
        expression: {
          function: 'round',
          arguments: [{ pointer: '/cost' }, { pointer: '/ward' }],
        },
        data,
      }),
    ).toBeUndefined();
  });

  it('joins strings and numbers, and gives no value when a part is missing or not text', () => {
    expect(
      evaluateMappingExpression({
        expression: {
          function: 'concat',
          arguments: [
            { pointer: '/label' },
            { value: ' ' },
            { pointer: '/ward' },
          ],
        },
        data,
      }),
    ).toBe('Ward 7');
    expect(
      evaluateMappingExpression({
        expression: {
          function: 'concat',
          arguments: [{ pointer: '/label' }, { pointer: '/missing' }],
        },
        data,
      }),
    ).toBeUndefined();
    expect(
      evaluateMappingExpression({
        expression: {
          function: 'concat',
          arguments: [{ pointer: '/label' }, { pointer: '/flag' }],
        },
        data,
      }),
    ).toBeUndefined();
  });

  it('returns the first argument of coalesce that has a value', () => {
    expect(
      evaluateMappingExpression({
        expression: {
          function: 'coalesce',
          arguments: [
            { pointer: '/missing' },
            { pointer: '/empty' },
            { pointer: '/zero' },
            { pointer: '/title' },
          ],
        },
        data,
      }),
    ).toBe(0);
    expect(
      evaluateMappingExpression({
        expression: {
          function: 'coalesce',
          arguments: [{ pointer: '/missing' }, { pointer: '/nothing' }],
        },
        data,
      }),
    ).toBeUndefined();
  });

  it('sums numbers and does not treat a missing argument as zero', () => {
    expect(
      evaluateMappingExpression({
        expression: {
          function: 'sum',
          arguments: [{ pointer: '/cost' }, { pointer: '/ward' }],
        },
        data,
      }),
    ).toBe(1241.5);
    expect(
      evaluateMappingExpression({
        expression: {
          function: 'sum',
          arguments: [{ pointer: '/cost' }, { pointer: '/missing' }],
        },
        data,
      }),
    ).toBeUndefined();
  });
});
