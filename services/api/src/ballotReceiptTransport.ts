/**
 * A ballot receipt is the only key to an anonymous ballot, so it travels in a
 * request body and never in a URL, where access logs would keep it beside
 * the session that sent it. The client sends an input that carries one as a
 * POST (`links.ts`), the server refuses it on anything else
 * (`assertReceiptInBody`), and the query cache never persists it
 * (`TRPCProvider.tsx`).
 */
export function carriesBallotReceipt(input: unknown): boolean {
  if (typeof input !== 'object' || input === null) {
    return false;
  }

  return (
    ('receipt' in input && input.receipt !== undefined) ||
    ('ballotReceipt' in input && input.ballotReceipt !== undefined)
  );
}

/** The input in a tRPC react-query key, shaped `[path, { input, type }]`. */
export function queryInput(queryKey: readonly unknown[]): unknown {
  const options = queryKey[1];

  return typeof options === 'object' && options !== null && 'input' in options
    ? options.input
    : undefined;
}
