import { AuthGateError } from '@op/common';
import { describe, expect, it } from 'vitest';

import { createGatingCallers, type GatingTestCtx } from './callers';

type GatingBody = (ctx: GatingTestCtx) => Promise<void>;

/**
 * Generic network-gating matrix for any authenticated endpoint.
 *
 * Unlike `describeDecisionGating`, this helper carries no domain-specific
 * context (e.g. public vs non-public instances) — it varies only the caller's
 * JWT, across the access ladder:
 *
 *   - no-JWT      — an unauthenticated request (no session cookie)
 *   - anon-JWT    — a Supabase anonymous sign-in
 *   - user-JWT    — an authenticated account that is *not* in the network
 *   - network-JWT — an authenticated in-network user
 *
 * For a `commonAuthedProcedure` endpoint, the gate rejects the first three with
 * `AuthGateError` (no session / anon / not allow-listed) and admits
 * network-JWT — so the network-JWT cell asserts the caller gets *past* the gate
 * via {@link expectPassesAuthGate}, while the others assert the rejection. A
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

export const describeGating = (name: string, cells: GatingCells) => {
  describe(`${name}: network gating`, () => {
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
 * Asserts a call is admitted by the authentication gate.
 *
 * The gate (`verifyAuthentication` / the `withAuthenticated*` middlewares)
 * throws {@link AuthGateError} — and nothing else does. So the check is a
 * single `instanceof` on the rejection's cause, with no message parsing: an
 * `AuthGateError` means the gate blocked the caller, anything else (a
 * resolve, input validation, not-found, or a deeper authorization
 * `UnauthorizedError`) means the gate let them through.
 */
export const expectPassesAuthGate = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    const cause = (error as { cause?: unknown }).cause;

    expect(
      cause instanceof AuthGateError,
      `expected to pass the auth gate but was rejected by it: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    ).toBe(false);
  }
};
