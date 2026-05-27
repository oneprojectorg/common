import type { User } from '@op/supabase/lib';

/**
 * Reserved UUIDs for the two global "role-bearer" users. These are real
 * Supabase auth users (created at seed time) that no human can sign in
 * as — they exist only so the standard `profile_users → access_roles`
 * model can express "this instance grants role X to anonymous callers"
 * and "this instance grants role Y to no-JWT callers" without writing
 * per-actor rows for every visitor.
 *
 * The IDs sit in the same reserved range as the access-role / access-zone
 * seed UUIDs so they're recognisable in logs.
 */
export const GLOBAL_USER_PUBLIC_ID =
  '00000000-0000-4000-8000-000000000020';

export const GLOBAL_USER_ANONYMOUS_ID =
  '00000000-0000-4000-8000-000000000021';

/**
 * Reserved emails for the two globals. Domain `@oneproject.internal` is
 * picked specifically because it can never resolve to a real user signup
 * (we control the domain). The auth trigger that fires on `auth.users`
 * insertions consumes these to create the `public.users` rows.
 */
export const GLOBAL_USER_PUBLIC_EMAIL = 'global-public@oneproject.internal';

export const GLOBAL_USER_ANONYMOUS_EMAIL =
  'global-anonymous@oneproject.internal';

/**
 * Sentinel Supabase user objects matching the two seeded `auth.users`
 * rows. `withResolvedUser` places one of these into
 * `ctx.authContext.accessUser` so any permission query has a stable,
 * always-defined user to JOIN against — no `User | undefined` narrowing
 * at query sites. The IDs match real DB rows so lookups keyed on
 * `user.id` succeed.
 *
 * `is_anonymous` is `false` on both — these aren't Supabase anonymous
 * users (those are real callers); these are our DB-backed role-bearer
 * sentinels.
 */
export const GLOBAL_USER_PUBLIC: User = {
  id: GLOBAL_USER_PUBLIC_ID,
  email: GLOBAL_USER_PUBLIC_EMAIL,
  is_anonymous: false,
  aud: 'authenticated',
  created_at: '1970-01-01T00:00:00.000Z',
  app_metadata: {},
  user_metadata: {},
};

export const GLOBAL_USER_ANONYMOUS: User = {
  id: GLOBAL_USER_ANONYMOUS_ID,
  email: GLOBAL_USER_ANONYMOUS_EMAIL,
  is_anonymous: false,
  aud: 'authenticated',
  created_at: '1970-01-01T00:00:00.000Z',
  app_metadata: {},
  user_metadata: {},
};

export const isGlobalUser = (user: { id: string }): boolean =>
  user.id === GLOBAL_USER_PUBLIC_ID || user.id === GLOBAL_USER_ANONYMOUS_ID;
