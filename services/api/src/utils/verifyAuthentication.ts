import { AccessTierError, UnauthorizedError } from '@op/common';
import { adminEmails } from '@op/core';
import type { UserResponse } from '@op/supabase/lib';

/**
 * Verifies the caller is at least a confirmed, real (non-anonymous) user — the
 * `user` tier. Throws {@link AccessTierError} carrying the caller's actual tier
 * when they fall short:
 *
 *   - no session / auth error  → actual `none` (401)
 *   - anonymous / unconfirmed  → actual `anon` (403)
 *
 * Network membership is checked by the caller (it needs an async allow-list
 * lookup); admin membership is authorization, not a tier, so a non-admin who
 * passed the tier check is rejected with a plain {@link UnauthorizedError}.
 */
export const verifyAuthentication = (data: UserResponse, adminOnly = false) => {
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

  // Admin membership is authorization, not a tier: a valid user who is not an
  // admin has met the tier requirement but lacks permission.
  if (adminOnly && !adminEmails.includes(data.data.user.email || '')) {
    throw new UnauthorizedError('User is not an admin');
  }

  return data.data.user;
};
