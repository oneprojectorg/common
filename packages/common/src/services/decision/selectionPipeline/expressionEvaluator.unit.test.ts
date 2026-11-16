import { describe, expect, it } from 'vitest';

import {
  buildProposalRow,
  buildVoteAggregation,
} from '../../../../testing/helpers/proposalRows';
import { evaluateExpression, setValueByPath } from './expressionEvaluator';
import type { ComparisonExpression, ExecutionContext } from './types';

const proposal = buildProposalRow({
  id: 'p1',
  proposalData: { title: 'Park' },
});

const context: ExecutionContext = {
  proposals: [proposal],
  proposal,
  voteData: {
    p1: buildVoteAggregation({ proposalId: 'p1', rankCounts: { 1: 9 } }),
  },
  variables: {},
  outputs: {},
};

describe('evaluateExpression field access', () => {
  it('reads a field on the current proposal', () => {
    expect(evaluateExpression({ field: 'proposalData.title' }, context)).toBe(
      'Park',
    );
  });

  it('reads the current proposal metrics through voteData', () => {
    expect(
      evaluateExpression({ field: 'voteData.rankCounts.1' }, context),
    ).toBe(9);
  });

  it('returns null when the current proposal has no metrics', () => {
    expect(
      evaluateExpression(
        { field: 'voteData.rankCounts.1' },
        { ...context, voteData: {} },
      ),
    ).toBeNull();
  });

  it('reads voteData as the whole metrics map when no proposal is set', () => {
    expect(
      evaluateExpression(
        { field: 'voteData.p1.rankCounts.1' },
        { ...context, proposal: undefined },
      ),
    ).toBe(9);
  });
});

describe('evaluateExpression function calls', () => {
  const call = (name: string, ...values: unknown[]) =>
    evaluateExpression(
      { function: name, arguments: values.map((value) => ({ value })) },
      context,
    );

  it.each([
    ['sum', [1, 2, 'x'], 3],
    ['avg', [2, 4], 3],
    ['avg', [], 0],
    ['count', [1, null, 'a'], 3],
    ['min', [3, 1, 'x'], 1],
    ['max', [3, 1, 'x'], 3],
    ['coalesce', [null, undefined, 0, 5], 0],
    ['concat', ['a', 1, true], 'a1true'],
    ['length', ['abc'], 3],
    ['length', [[1, 2]], 2],
    ['length', [7], 0],
    ['abs', [-2.5], 2.5],
    ['abs', ['x'], 0],
    ['round', [2.5], 3],
    ['floor', [2.7], 2],
    ['ceil', [2.1], 3],
    ['toLowerCase', ['AbC'], 'abc'],
    ['toUpperCase', ['AbC'], 'ABC'],
    ['toUpperCase', [3], ''],
    ['trim', ['  a '], 'a'],
  ])('%s(%j) evaluates to %j', (name, values, expected) => {
    expect(call(name, ...values)).toEqual(expected);
  });

  it('picks the branch of an if by its condition', () => {
    expect(call('if', true, 'yes', 'no')).toBe('yes');
    expect(call('if', 0, 'yes', 'no')).toBe('no');
  });

  it('rejects an if without three arguments', () => {
    expect(() => call('if', true, 'yes')).toThrow('if function requires');
  });

  it('rejects an unknown function', () => {
    expect(() => call('constructor', 1)).toThrow('Unknown function');
  });
});

describe('evaluateExpression comparisons', () => {
  const compare = (
    operator: ComparisonExpression['operator'],
    left: unknown,
    right: unknown,
  ) =>
    evaluateExpression(
      { operator, left: { value: left }, right: { value: right } },
      context,
    );

  it.each<[ComparisonExpression['operator'], unknown, unknown, boolean]>([
    ['equals', 1, 1, true],
    ['equals', 1, '1', false],
    ['notEquals', 1, 2, true],
    ['greaterThan', 2, 1, true],
    ['lessThan', 2, 1, false],
    ['greaterThanOrEquals', 1, 1, true],
    ['lessThanOrEquals', 2, 1, false],
    ['in', 'a', ['a', 'b'], true],
    ['in', 'a', 'ab', false],
    ['notIn', 'c', ['a', 'b'], true],
    ['contains', 'park', 'ar', true],
    ['contains', ['a', 'b'], 'b', true],
    ['contains', 5, '5', false],
    ['startsWith', 'park', 'pa', true],
    ['endsWith', 'park', 'rk', true],
    ['endsWith', 5, '5', false],
    ['matches', 'park', '^p.*k$', true],
    ['matches', 'aaaa', '(a+)+$', false],
    ['matches', 'park', '(', false],
    ['matches', 5, '5', false],
  ])('%s(%j, %j) is %s', (operator, left, right, expected) => {
    expect(compare(operator, left, right)).toBe(expected);
  });

  it('rejects an unknown operator', () => {
    // @ts-expect-error an operator the schema does not allow
    expect(() => compare('roughlyEquals', 1, 1)).toThrow(
      'Unknown comparison operator',
    );
  });
});

describe('evaluateExpression logic', () => {
  const yes = { value: true };
  const no = { value: false };

  it('combines with and, or and not', () => {
    expect(evaluateExpression({ and: [yes, no] }, context)).toBe(false);
    expect(evaluateExpression({ or: [yes, no] }, context)).toBe(true);
    expect(evaluateExpression({ not: yes }, context)).toBe(false);
  });

  it('rejects an empty logical expression', () => {
    // @ts-expect-error a logical expression needs and, or or not
    expect(() => evaluateExpression({}, context)).toThrow(
      'Unknown expression type',
    );
  });
});

describe('setValueByPath', () => {
  it('creates the nested objects on the way to the leaf', () => {
    const target: Record<string, unknown> = {};

    setValueByPath(target, 'metadata.score.total', 7);

    expect(target).toEqual({ metadata: { score: { total: 7 } } });
  });

  it('never writes through a key that reaches the prototype', () => {
    const target: Record<string, unknown> = {};

    setValueByPath(target, '__proto__.polluted', true);
    setValueByPath(target, 'constructor', true);

    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
    expect(Object.hasOwn(target, '__proto__')).toBe(false);
    expect(Object.hasOwn(target, 'constructor')).toBe(false);
  });
});
