import type { CommonUser } from '@op/api/encoders';
import { isSafeRedirectPath } from '@op/common/client';
import { headers } from 'next/headers';
import { forbidden, redirect } from 'next/navigation';

/**
 * The walled-garden gate. Use in the layout of any closed-network route group.
 *
 * - No session (or an anonymous one) → redirect to login (preserving the
 *   attempted path so the user lands back there after signing in): logging in
 *   can grant access.
 * - A real account outside the network (no `isNetworkMember`) → `forbidden()`:
 *   logging in as the same account won't help, so show the no-access screen.
 *
 * `allowOutsideNetwork` admits a real (non-anonymous) account that isn't a
 * member of the closed network — used by the promote/anon-upgrade onboarding,
 * where the user is mid-flow and hasn't joined the network yet. Anonymous
 * sessions still redirect.
 */
export async function assertWalledGardenAccess(
  user: CommonUser | null | undefined,
  { allowOutsideNetwork = false }: { allowOutsideNetwork?: boolean } = {},
) {
  if (!user || user.isAnonymous) {
    const pathname = (await headers()).get('x-pathname');

    redirect(
      isSafeRedirectPath(pathname)
        ? `/login?redirect=${encodeURIComponent(pathname)}`
        : '/login',
    );
  }

  if (!allowOutsideNetwork && !user.isNetworkMember) {
    forbidden();
  }
}
