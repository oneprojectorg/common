import { GLOBAL_USER_ANONYMOUS, GLOBAL_USER_PUBLIC } from '@op/common';
import type { User } from '@op/supabase/lib';

import { getCachedAuthUser } from '../supabase/server';
import type {
  MiddlewareBuilderBase,
  TContextWithAuthContext,
} from '../types';

/**
 * Resolves the caller's Supabase user and produces a uniform
 * `ctx.authContext`:
 *
 * - `ctx.authContext.user` is the real Supabase user (anon or authed) or
 *   `undefined` for no-JWT callers — the source of truth for identity.
 * - `ctx.authContext.accessUser` is always defined and is what every
 *   permission lookup should JOIN on: real user for authed, the
 *   GLOBAL_USER_ANONYMOUS sentinel for anon-JWT, the GLOBAL_USER_PUBLIC
 *   sentinel for no-JWT.
 *
 * No allow-list check, no anon rejection, no email-confirmation gate —
 * authorization for the kinds of endpoints that use this middleware
 * lives entirely in the service layer (via the access-roles seeded on
 * the instance profile for the two global users).
 */
const withResolvedUser: MiddlewareBuilderBase<TContextWithAuthContext> =
  async ({ ctx, next }) => {
    const data = await getCachedAuthUser(ctx);
    const realUser =
      !data || data.error || !data.data?.user ? undefined : data.data.user;

    let user: User | undefined;
    let accessUser: User;

    if (!realUser) {
      user = undefined;
      accessUser = GLOBAL_USER_PUBLIC;
    } else if (realUser.is_anonymous) {
      // NOTE: anon Supabase users have no email on the JWT. Some
      // downstream service paths (e.g. createProposal inserting the
      // proposal-owner row) require a non-null email. Synthesize a
      // stable placeholder here so the service layer doesn't have to
      // special-case anon callers. The auth trigger already writes the
      // same placeholder to `public.users`. Remove once
      // `profile_users.email` is nullable or services source email
      // from `public.users`.
      user = realUser.email
        ? realUser
        : { ...realUser, email: `anon-${realUser.id}@public.local` };
      accessUser = GLOBAL_USER_ANONYMOUS;
    } else {
      user = realUser;
      accessUser = realUser;
    }

    return next({
      ctx: { ...ctx, authContext: { user, accessUser } },
    });
  };

export default withResolvedUser;
