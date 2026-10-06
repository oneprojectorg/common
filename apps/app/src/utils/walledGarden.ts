import type { CommonUser } from '@op/api/encoders';
import { isSafeRedirectPath } from '@op/common/client';
import '@tanstack/react-start/server-only';
import { forbidden, redirect } from '@/lib/navigation';

/**
 * The walled-garden gate. Call it from the server function behind the
 * `beforeLoad` of any closed-network route.
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
export function assertWalledGardenAccess(
  user: CommonUser | null | undefined,
  {
    pathname,
    allowNonMembers = false,
  }: { pathname: string; allowNonMembers?: boolean },
): asserts user is CommonUser {
  if (!user || user.isAnonymous) {
    redirect(
      isSafeRedirectPath(pathname)
        ? `/login?redirect=${encodeURIComponent(pathname)}`
        : '/login',
    );
  }

  if (!allowNonMembers && !user.isNetworkMember) {
    forbidden();
  }
}
