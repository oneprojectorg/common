import { AccessTierError } from '@op/common';
import type { UserResponse } from '@op/supabase/lib';

/**
 * Verifies the caller is at least a confirmed, real (non-anonymous) user — the
 * `user` tier. Throws {@link AccessTierError} carrying the caller's actual tier
 * when they fall short:
 *
 *   - no session / auth error  → actual `none` (401)
 *   - anonymous / unconfirmed  → actual `anon` (403)
 *
 * Network membership and admin authorization are checked by the caller; this
 * helper only establishes that a confirmed user is present.
 */
export const verifyAuthentication = (data: UserResponse) => {
  if (!data) {
    throw new AccessTierError('none');
  }

  if (data.error) {
    throw new AccessTierError('none');
  }

  if (data.data.user.is_anonymous) {
    throw new AccessTierError('anon');
  }

  if (data.data.user.confirmed_at === null) {
    throw new AccessTierError('anon');
  }

  return data.data.user;
};
