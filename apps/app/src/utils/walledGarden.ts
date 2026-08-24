import type { CommonUser } from '@op/api/encoders';
import { isSafeRedirectPath } from '@op/common/client';
import { headers } from 'next/headers';
import { forbidden, redirect } from 'next/navigation';

/**
 * Half of the walled-garden gate: turn a session-less or anonymous visitor away
 * to login, preserving the attempted path so they land back here after signing
 * in. Returns the account for a real (non-anonymous) session — what a real
 * account that is still refused should see is the caller's decision, because it
 * differs by surface (the closed-network gate below shows `forbidden()`; a
 * public decision route shows its own invite-aware screen).
 *
 * Split out so both callers share one definition of "signing in could help".
 */
export async function requireRealAccount(
  user: CommonUser | null | undefined,
): Promise<CommonUser> {
  if (user && !user.isAnonymous) {
    return user;
  }

  const pathname = (await headers()).get('x-pathname');

  redirect(
    isSafeRedirectPath(pathname)
      ? `/login?redirect=${encodeURIComponent(pathname)}`
      : '/login',
  );
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
