import type { CommonUser } from '@op/api/encoders';
import { forbidden, redirect } from 'next/navigation';

/**
 * The walled-garden gate. Use in the layout of any closed-network route group.
 *
 * - No session (or an anonymous one) → redirect to login: logging in can grant
 *   access, so send them there.
 * - A real account that isn't a network member → `forbidden()`: logging in as
 *   the same account won't help, so show the no-access screen.
 */
export function assertWalledGardenAccess(
  user: CommonUser | null | undefined,
): asserts user is CommonUser {
  if (!user || user.isAnonymous) {
    redirect('/login');
  }

  if (!user.isNetworkMember) {
    forbidden();
  }
}
