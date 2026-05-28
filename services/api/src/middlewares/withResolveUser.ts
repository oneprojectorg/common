import type { User } from '@op/supabase/lib';

import { getCachedAuthUser } from '../supabase/server';
import type { MiddlewareBuilderBase, TContextWithMaybeUser } from '../types';

/**
 * Resolves the caller's Supabase user into `ctx.user`:
 *
 * - real authed user → that user
 * - anon-JWT caller → the anon user (email synthesized if missing)
 * - no JWT at all → `undefined`
 *
 * No allow-list check, no anon rejection, no email-confirmation gate —
 * authorization for endpoints stacked on this middleware lives in the
 * service layer (`getProfileAccessUser` / `getOrgAccessUser` substitute
 * the seeded GLOBAL_USER_PUBLIC / GLOBAL_USER_ANONYMOUS sentinels when
 * looking up role grants).
 */
const withResolveUser: MiddlewareBuilderBase<TContextWithMaybeUser> = async ({
  ctx,
  next,
}) => {
  const data = await getCachedAuthUser(ctx);
  const realUser =
    !data || data.error || !data.data?.user ? undefined : data.data.user;

  let user: User | undefined;

  if (!realUser) {
    user = undefined;
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
  } else {
    user = realUser;
  }

  return next({
    ctx: { ...ctx, user },
  });
};

export default withResolveUser;
