import { describe, expect, it } from 'vitest';

import { assertReceiptInBody } from './assertReceiptInBody';

const ctx = ({
  method,
  isServerSideCall = false,
}: {
  method: string;
  isServerSideCall?: boolean;
}) => ({
  req: new Request('http://localhost/api/v1/trpc/decision.getBallot', {
    method,
  }),
  isServerSideCall,
});

describe('assertReceiptInBody', () => {
  it('accepts a receipt in a POST', () => {
    expect(() =>
      assertReceiptInBody({
        ctx: ctx({ method: 'POST' }),
        input: { receipt: 'r' },
      }),
    ).not.toThrow();
  });

  it('refuses a receipt on a GET, where it would land in the URL', () => {
    expect(() =>
      assertReceiptInBody({
        ctx: ctx({ method: 'GET' }),
        input: { receipt: 'r' },
      }),
    ).toThrow('A ballot receipt is only accepted in a POST body');
    expect(() =>
      assertReceiptInBody({
        ctx: ctx({ method: 'GET' }),
        input: { ballotReceipt: 'r' },
      }),
    ).toThrow('A ballot receipt is only accepted in a POST body');
  });

  it('lets a GET without a receipt through', () => {
    expect(() =>
      assertReceiptInBody({
        ctx: ctx({ method: 'GET' }),
        input: { processInstanceId: 'x' },
      }),
    ).not.toThrow();
  });

  it('skips the check on a server-side call, which sends no request', () => {
    expect(() =>
      assertReceiptInBody({
        ctx: ctx({ method: 'GET', isServerSideCall: true }),
        input: { receipt: 'r' },
      }),
    ).not.toThrow();
  });
});
