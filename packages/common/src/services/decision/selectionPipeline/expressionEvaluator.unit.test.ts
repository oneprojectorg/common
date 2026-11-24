import { describe, expect, it } from 'vitest';

import { evaluateExpression } from './expressionEvaluator';
import type { Expression } from './types';

const call = (name: string, ...values: unknown[]): Expression => ({
  function: name,
  arguments: values.map((value) => ({ value })),
});

describe('evaluateExpression value functions', () => {
  it.each([
    { name: 'decimalSum', args: [0.1, null, 0.2], result: 0.3 },
    {
      name: 'decimalSum',
      args: [50322.58, 50322.58, 289354.84],
      result: 390000,
    },
    { name: 'decimalSum', args: [], result: 0 },
    { name: 'decimalSum', args: [1, '2'], result: null },
    { name: 'decimalSum', args: [1, Infinity], result: null },
    { name: 'same', args: ['USD', null, 'USD'], result: 'USD' },
    { name: 'same', args: ['USD', 'EUR'], result: null },
    { name: 'same', args: [null], result: null },
    { name: 'isMoney', args: [{ amount: 1, currency: 'USD' }], result: true },
    {
      name: 'isMoney',
      args: [{ amount: 1, currency: 'USD', note: 'x' }],
      result: false,
    },
    {
      name: 'isMoney',
      args: [{ amount: null, currency: 'USD' }],
      result: false,
    },
    { name: 'isMoney', args: [1], result: false },
    {
      name: 'money',
      args: [1, 'USD'],
      result: { amount: 1, currency: 'USD' },
    },
    { name: 'money', args: [1, null], result: null },
    { name: 'money', args: [Infinity, 'USD'], result: null },
  ])('$name of $args gives $result', ({ name, args, result }) => {
    expect(
      evaluateExpression(call(name, ...args), {
        record: {},
        variables: {},
        outputs: {},
      }),
    ).toEqual(result);
  });
});
