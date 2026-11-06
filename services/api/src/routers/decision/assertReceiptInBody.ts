import { TRPCError } from '@trpc/server';

import { carriesBallotReceipt } from '../../ballotReceiptTransport';
import type { TContext } from '../../types';

/**
 * Refuses a receipt that arrived in a URL. See `ballotReceiptTransport.ts`.
 * A server-side caller has no request to inspect.
 */
export function assertReceiptInBody({
  ctx,
  input,
}: {
  ctx: Pick<TContext, 'req' | 'isServerSideCall'>;
  input: unknown;
}): void {
  if (
    carriesBallotReceipt(input) &&
    !ctx.isServerSideCall &&
    ctx.req.method !== 'POST'
  ) {
    throw new TRPCError({
      code: 'METHOD_NOT_SUPPORTED',
      message: 'A ballot receipt is only accepted in a POST body',
    });
  }
}
