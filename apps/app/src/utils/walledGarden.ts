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
 * - A real account that isn't a network member → `forbidden()`: logging in as
 *   the same account won't help, so show the no-access screen.
 */
export async function assertWalledGardenAccess(
  user: CommonUser | null | undefined,
) {
  if (!user || user.isAnonymous) {
    const pathname = (await headers()).get('x-pathname');

    redirect(
      isSafeRedirectPath(pathname)
        ? `/login?redirect=${encodeURIComponent(pathname)}`
        : '/login',
    );
  }

  if (!user.isNetworkMember) {
    forbidden();
  }
}
