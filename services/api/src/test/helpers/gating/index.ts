import { type AccessTier, AccessTierError } from '@op/common';
import { describe, expect, it } from 'vitest';

import { createGatingCallers, type GatingTestCtx } from './callers';

type GatingBody = (ctx: GatingTestCtx) => Promise<void>;

export type GatingCell = {
  title: string;
  run: GatingBody;
};

/**
 * Generic access-tier gating matrix for any authenticated endpoint.
 *
 * Unlike `describeDecisionAccessTierGating`, this helper carries no domain-specific
 * context (e.g. public vs non-public instances) — it varies only the caller's
 * JWT, across the access ladder:
 *
 *   - no-JWT      — an unauthenticated request (no session cookie)
 *   - anon-JWT    — a Supabase anonymous sign-in
 *   - user-JWT    — an authenticated account that is *not* in the network
 *   - network-JWT — an authenticated in-network user
 *
 * For a `commonAuthedProcedure` endpoint (required tier `network`), the gate
 * rejects the first three with an `AccessTierError` — `callerTier: 'none'`
 * (401) for no-JWT, `callerTier: 'anon'` (403) for anon-JWT, and
 * `callerTier: 'user'` (403) for the out-of-network user-JWT — and admits
 * network-JWT. So the reject cells assert the caller's tier via
 * {@link expectFailsAccessTierGate}, and the network-JWT cell asserts the caller gets
 * *past* the gate via {@link expectPassesAccessTierGate}. A
 * `withAuthenticatedPlatformAdmin` endpoint instead rejects user-JWT with
 * `UnauthorizedError` (authenticated, but not an admin), and a public procedure
 * admits every tier.
 *
 * Forgetting a key is a compile error.
 */
export type GatingCells = {
  noJwt: GatingCell;
  anonJwt: GatingCell;
  userJwt: GatingCell;
  networkJwt: GatingCell;
};

export const accessTierGatingCell = (
  title: string,
  run: GatingBody,
): GatingCell => ({
  title,
  run,
});

export const itAccessTierGatingCell = (cell: GatingCell) => {
  const { run, title } = cell;

  it.concurrent(
    title,
    async ({
      task,
      onTestFinished,
    }: {
      task: { id: string };
      onTestFinished: (fn: () => void | Promise<void>) => void;
    }) => {
      await run({
        task,
        onTestFinished,
        callers: createGatingCallers(onTestFinished),
      });
    },
  );
};

export const describeAccessTierGating = (name: string, cells: GatingCells) => {
  describe.concurrent(`${name}: access-tier gating`, () => {
    itAccessTierGatingCell(cells.noJwt);
    itAccessTierGatingCell(cells.anonJwt);
    itAccessTierGatingCell(cells.userJwt);
    itAccessTierGatingCell(cells.networkJwt);
  });
};

/**
 * Asserts a call is admitted by the tier gate.
 *
 * The gate (`verifyAuthentication` / the `withAuthenticated*` middlewares)
 * throws {@link AccessTierError} — and nothing else does. So the check is a
 * single `instanceof` on the rejection's cause, with no message parsing: an
 * `AccessTierError` means the gate blocked the caller, anything else (a
 * resolve, input validation, not-found, or a deeper resource-authorization
 * `UnauthorizedError`) means the gate let them through.
 *
 * @see expectFailsAccessTierGate for the inverse assertion.
 */
export const expectPassesAccessTierGate = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    const cause = (error as { cause?: unknown }).cause;

    expect(
      cause instanceof AccessTierError,
      `expected to pass the tier gate but was rejected by it: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    ).toBe(false);
  }
};

/**
 * Asserts a call is rejected by the tier gate, carrying the `callerTier` of the
 * rejected caller and the HTTP status it pins — `'none'` is 401 (authenticate),
 * everything else is 403.
 */
export const expectFailsAccessTierGate = async (
  promise: Promise<unknown>,
  callerTier: AccessTier,
) => {
  await expect(promise).rejects.toMatchObject({
    cause: {
      name: 'AccessTierError',
      callerTier,
      statusCode: callerTier === 'none' ? 401 : 403,
    },
  });
};
