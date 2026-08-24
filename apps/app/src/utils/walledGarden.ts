import type { CommonUser } from '@op/api/encoders';
import { isSafeRedirectPath } from '@op/common/client';
import { headers } from 'next/headers';
import { forbidden, redirect } from 'next/navigation';

/**
 * Returns a real account; redirects a session-less or anonymous caller to login
 * with the attempted path to return to. What a *refused* real account sees is
 * left to the caller, because it differs by surface — the closed-network gate
 * shows `forbidden()`, a public decision route its own invite-aware screen.
 *
 * `linkAnonymous` sends an anonymous caller to link mode (`/login?link=1`,
 * LinkAccountPanel) instead of the plain panel, so anything they created while
 * anonymous stays on the same auth user. Opt-in, and only correct on surfaces
 * where anonymous participation is a feature: link mode claims an account
 * through `useClaimAccount`, which deliberately bypasses the invite-only
 * allow-list that `account.login` enforces.
 */
export async function requireRealAccount(
  user: CommonUser | null | undefined,
  { linkAnonymous = false }: { linkAnonymous?: boolean } = {},
): Promise<CommonUser> {
  if (user && !user.isAnonymous) {
    return user;
  }

  const requestHeaders = await headers();
  // Keep the query string attached to the path. On the decision routes it
  // carries the open side panel and the proposal being read, so dropping it
  // turns a shared deep link into the bare overview. `getSafeRedirectPath`
  // re-validates the whole string when /login consumes it.
  const attempted = `${requestHeaders.get('x-pathname') ?? ''}${
    requestHeaders.get('x-search') ?? ''
  }`;

  const params = new URLSearchParams();
  if (linkAnonymous && user?.isAnonymous) {
    params.set('link', '1');
  }
  if (isSafeRedirectPath(attempted)) {
    params.set('redirect', attempted);
  }

  const query = params.toString();

  redirect(query ? `/login?${query}` : '/login');
}

/**
 * The walled-garden gate. Use in the layout of any closed-network route group.
 *
 * - No session (or an anonymous one) → redirect to login (preserving the
 *   attempted path so the user lands back there after signing in): logging in
 *   can grant access.
 * - A real account that isn't a network member → `forbidden()`: logging in as
 *   the same account won't help, so show the no-access screen.
 *
 * `allowNonMembers` admits a real (non-anonymous) account that isn't a network
 * member — used by the promote/anon-upgrade onboarding. Anonymous still redirects.
 */
export async function assertWalledGardenAccess(
  user: CommonUser | null | undefined,
  { allowNonMembers = false }: { allowNonMembers?: boolean } = {},
) {
  const account = await requireRealAccount(user);

  if (!allowNonMembers && !account.isNetworkMember) {
    forbidden();
  }
}
