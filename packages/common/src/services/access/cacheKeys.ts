import { GLOBAL_USER_PUBLIC } from '@op/core';
import type { User } from '@op/supabase/lib';

/**
 * The caller identity the access layer needs. A subset of the Supabase `User`
 * (only the id is read today); widen the `Pick` as later auth work needs more
 * fields. Optional throughout the access layer so a future no-JWT (public)
 * caller can be represented as `undefined` — resolvers fail closed on it.
 */
export type AccessUser = Pick<User, 'id'>;

/**
 * The set of auth-user ids whose grants make up a caller's *effective* access:
 * their own grants unioned with grants made to the public ({@link
 * GLOBAL_USER_PUBLIC}). So a no-JWT caller resolves only public grants, while an
 * authenticated or anonymous caller gets their own grants **and** any public
 * grant on the resource — that's what makes a "public" resource visible to
 * everyone (members, logged-in non-members, anonymous sessions, and no-JWT
 * visitors alike) without losing a caller's own (e.g. participant) grants.
 *
 * Always returns a non-empty set (at minimum the public sentinel), so an
 * undefined id can never drop the `authUserId` filter (Drizzle skips undefined
 * conditions — the fail-open trap). Use this everywhere grants are filtered —
 * `{ in: … }` / `inArray(…)` — and `.join(':')` it where a scalar cache-key
 * identity is needed.
 */
export const resolveAccessUserIds = (user?: AccessUser): string[] =>
  user?.id && user.id !== GLOBAL_USER_PUBLIC
    ? [user.id, GLOBAL_USER_PUBLIC]
    : [GLOBAL_USER_PUBLIC];

/**
 * The caller's own auth id, or `undefined` when they hold no account grants.
 * The counterpart to {@link resolveAccessUserIds} for a grant the public
 * sentinel can never hold — on a resource public grants never sit on, unioning
 * it in widens nothing and scans every public grant to prove it. `undefined`
 * means "no such grant is possible", so the caller drops the condition rather
 * than letting Drizzle skip it.
 */
export const resolveAccountUserId = (user?: AccessUser): string | undefined =>
  user?.id && user.id !== GLOBAL_USER_PUBLIC ? user.id : undefined;

/**
 * Cache key for the durable `orgUser` cache. Shared by the write site and every
 * invalidator so the key shape can't drift — the resolved id set (own ∪ public)
 * is part of the identity, so a stale `[organizationId, user.id]` key would miss
 * and serve removed/demoted members their old roles until TTL.
 */
export const orgUserCacheKey = ({
  user,
  organizationId,
}: {
  user?: AccessUser;
  organizationId: string;
}): [string, string] => [organizationId, resolveAccessUserIds(user).join(':')];

/**
 * Cache key for the durable `profileUser` cache. Shared by the write site and
 * every invalidator so the key shape can't drift — the resolved id set (own ∪
 * public) is part of the identity, so a stale `[profileId, user.id]` key would
 * miss and serve removed/demoted members their old roles until TTL.
 */
export const profileUserCacheKey = ({
  user,
  profileId,
}: {
  user?: AccessUser;
  profileId: string;
}): [string, string] => [profileId, resolveAccessUserIds(user).join(':')];
