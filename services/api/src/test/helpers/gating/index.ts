import { type AccessTier, AccessTierError } from '@op/common';
import { describe, expect, it } from 'vitest';

import { createGatingCallers, type GatingTestCtx } from './callers';

type GatingBody = (ctx: GatingTestCtx) => Promise<void>;

/**
 * Generic access-tier gating matrix for any authenticated endpoint.
 *
 * Unlike `describeDecisionProcedureGating`, this helper carries no domain-specific
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
 * {@link expectFailsTierGate}, and the network-JWT cell asserts the caller gets
 * *past* the gate via {@link expectPassesTierGate}. A
 * `withAuthenticatedPlatformAdmin` endpoint instead rejects user-JWT with
 * `UnauthorizedError` (authenticated, but not an admin), and a public procedure
 * admits every tier.
 *
 * Forgetting a key is a compile error.
 */
export type GatingCells = {
  noJwt: GatingBody;
  anonJwt: GatingBody;
  userJwt: GatingBody;
  networkJwt: GatingBody;
};

export const describeProcedureGating = (name: string, cells: GatingCells) => {
  describe(`${name}: tier gating`, () => {
    const wrap =
      (body: GatingBody) =>
      async ({
        task,
        onTestFinished,
      }: {
        task: { id: string };
        onTestFinished: (fn: () => void | Promise<void>) => void;
      }) => {
        await body({
          task,
          onTestFinished,
          callers: createGatingCallers(onTestFinished),
        });
      };

    it('no-JWT caller', wrap(cells.noJwt));
    it('anon-JWT caller', wrap(cells.anonJwt));
    it('user-JWT caller', wrap(cells.userJwt));
    it('network-JWT caller', wrap(cells.networkJwt));
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
 * @see expectFailsTierGate for the inverse assertion.
 */
export const expectPassesTierGate = async (promise: Promise<unknown>) => {
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
 * rejected caller (which also pins the HTTP status — `'none'` is 401,
 * everything else 403).
 */
export const expectFailsTierGate = async (
  promise: Promise<unknown>,
  callerTier: AccessTier,
) => {
  await expect(promise).rejects.toMatchObject({
    cause: { name: 'AccessTierError', callerTier },
  });
};
