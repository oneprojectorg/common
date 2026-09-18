import { ValidationError, DocumentFetchError } from '@op/common';
import { TRPCError, type TRPCDefaultErrorShape } from '@trpc/server';
import { describe, it, expect } from 'vitest';

import { errorFormatter } from './error';

function makeShape(): TRPCDefaultErrorShape {
  return {
    code: -32600, // BAD_REQUEST (tRPC numeric code)
    message: 'message',
    data: { code: 'BAD_REQUEST', httpStatus: 400 },
  };
}

function callFormatter(cause: unknown) {
  const error = new TRPCError({
    code: 'BAD_REQUEST',
    message: 'Proposal validation failed',
    cause,
  });
  return errorFormatter({
    error,
    type: 'mutation',
    path: 'decision.submitProposal',
    input: null,
    ctx: undefined,
    shape: makeShape(),
  });
}

type FormattedData = {
  code: string;
  httpStatus: number;
  timestamp: number;
  fieldErrors?: Record<string, string>;
};

function dataOf(out: { data: object }): FormattedData {
  return out.data as FormattedData;
}

describe('errorFormatter fieldErrors forwarding', () => {
  it('includes fieldErrors in data when the cause is a ValidationError with fieldErrors', () => {
    const fieldErrors = {
      a1b2c3d4: 'Title is required',
      e5f6a7b8: 'Budget must be 0 or more',
    };
    const cause = new ValidationError(
      'Proposal validation failed',
      fieldErrors,
    );

    const out = callFormatter(cause);

    expect(dataOf(out).fieldErrors).toEqual(fieldErrors);
    // The existing fields are preserved alongside the new one.
    expect(dataOf(out).code).toBe('BAD_REQUEST');
    expect(dataOf(out).httpStatus).toBe(400);
    expect(typeof dataOf(out).timestamp).toBe('number');
  });

  it('omits fieldErrors from data when the cause is a ValidationError without fieldErrors', () => {
    const cause = new ValidationError('Proposal validation failed');

    const out = callFormatter(cause);

    expect(dataOf(out).fieldErrors).toBeUndefined();
    expect('fieldErrors' in dataOf(out)).toBe(false);
  });

  it('omits fieldErrors from data when the cause is not a ValidationError', () => {
    const cause = new DocumentFetchError('TipTap fetch failed', {
      docId: 'proposal-1',
      status: 500,
    });

    const out = callFormatter(cause);

    expect(dataOf(out).fieldErrors).toBeUndefined();
  });
});
