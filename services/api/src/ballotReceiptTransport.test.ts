import { describe, expect, it } from 'vitest';

import { carriesBallotReceipt, queryInput } from './ballotReceiptTransport';

describe('carriesBallotReceipt', () => {
  it.each([
    ['a getBallot input', { processInstanceId: 'x', receipt: 'r' }],
    ['a proposal list filter', { processInstanceId: 'x', ballotReceipt: 'r' }],
  ])('is true for %s', (_, input) => {
    expect(carriesBallotReceipt(input)).toBe(true);
  });

  it.each([
    ['no input', undefined],
    ['a null input', null],
    ['a string', 'receipt'],
    ['an input without a receipt', { processInstanceId: 'x' }],
    ['an undefined receipt', { processInstanceId: 'x', receipt: undefined }],
    [
      'an undefined ballot receipt',
      { processInstanceId: 'x', ballotReceipt: undefined },
    ],
  ])('is false for %s', (_, input) => {
    expect(carriesBallotReceipt(input)).toBe(false);
  });
});

describe('queryInput', () => {
  it('reads the input out of a tRPC query key', () => {
    expect(
      queryInput([
        ['decision', 'getBallot'],
        { input: { receipt: 'r' }, type: 'query' },
      ]),
    ).toEqual({ receipt: 'r' });
  });

  it('is undefined for a key without options', () => {
    expect(queryInput([['decision', 'getBallot']])).toBeUndefined();
    expect(queryInput([])).toBeUndefined();
  });
});
