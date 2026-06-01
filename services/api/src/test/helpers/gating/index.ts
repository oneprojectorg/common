import { AuthenticationError } from '@op/common';
import { describe, expect, it } from 'vitest';

import { createGatingCallers, type GatingTestCtx } from './callers';

type GatingBody = (ctx: GatingTestCtx) => Promise<void>;

/**
 * Generic network-gating matrix for any authenticated endpoint.
 *
 * Unlike `describeDecisionGating`, this helper carries no domain-specific
 * context (e.g. public vs non-public instances) — it varies only the caller's
 * JWT:
 *
 *   - no-JWT     — an unauthenticated request (no session cookie)
 *   - anon-JWT   — a Supabase anonymous sign-in
 *   - common-JWT — a normal authenticated `@oneproject.org` user
 *
 * Endpoints behind `commonAuthedProcedure` (or `withAuthenticatedPlatformAdmin`)
 * reject the first two at the auth middleware — before input parsing — and
 * admit the third. The common-JWT cell should assert the caller gets *past*
 * the auth gate via {@link expectPassesAuthGate}; it does not have to reach a
 * successful business outcome.
 *
 * Forgetting a key is a compile error.
 */
export type GatingCells = {
  noJwt: GatingBody;
  anonJwt: GatingBody;
  commonJwt: GatingBody;
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
    it('common-JWT caller', wrap(cells.commonJwt));
  });
};

/**
 * Asserts a call is admitted by the authentication gate.
 *
 * The gate (`verifyAuthentication` / the `withAuthenticated*` middlewares)
 * throws {@link AuthenticationError} — and nothing else does. So the check is a
 * single `instanceof` on the rejection's cause, with no message parsing: an
 * `AuthenticationError` means the gate blocked the caller, anything else (a
 * resolve, input validation, not-found, or a deeper authorization
 * `UnauthorizedError`) means the gate let them through.
 */
export const expectPassesAuthGate = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    const cause = (error as { cause?: unknown }).cause;

    expect(
      cause instanceof AuthenticationError,
      `expected to pass the auth gate but was rejected by it: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    ).toBe(false);
  }
};
