import { AuthGateError, UnauthorizedError } from '@op/common';
import { adminEmails } from '@op/core';
import type { UserResponse } from '@op/supabase/lib';

/**
 * Verifies user authentication from Supabase response.
 * Throws a Common error if authentication fails.
 */
export const verifyAuthentication = (data: UserResponse, adminOnly = false) => {
  if (!data) {
    throw new AuthGateError('Failed to authenticate user');
  }

  if (data.error) {
    throw new AuthGateError(`Authentication error: ${data.error.message}`);
  }

  if (data.data.user.is_anonymous) {
    throw new AuthGateError(
      'Anonymous users are not allowed to access this resource',
    );
  }

  if (data.data.user.confirmed_at === null) {
    throw new AuthGateError('User has not confirmed their email address');
  }

  // Admin membership is authorization, not authentication: a valid user who is
  // not an admin has passed the gate but lacks permission.
  if (adminOnly && !adminEmails.includes(data.data.user.email || '')) {
    throw new UnauthorizedError('User is not an admin');
  }

  return data.data.user;
};
