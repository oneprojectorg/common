import type { CommonUser } from '@op/api/encoders';
import { forbidden } from 'next/navigation';

import { redirectToLogin } from './getUser';

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
  if (!user || user.isAnonymous) {
    return redirectToLogin();
  }

  if (!allowNonMembers && !user.isNetworkMember) {
    forbidden();
  }
}
