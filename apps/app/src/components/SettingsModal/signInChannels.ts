import { normalizePhoneNumber, phoneNumberSchema } from '@op/common/client';

import { isValidEmail } from '../decisions/emailUtils';

export type SignInChannel = 'email' | 'phone';

/** Why a new sign-in email or phone number was rejected. */
export type ChannelValueError = 'required' | 'invalid' | 'unchanged';

export const otherChannel = (channel: SignInChannel): SignInChannel =>
  channel === 'email' ? 'phone' : 'email';

/**
 * Checks a new value for a sign-in channel before a code is sent to it, with
 * the same rules the login screen applies. `current` is the value already on
 * file, if any.
 */
export const validateChannelValue = (
  channel: SignInChannel,
  value: string,
  current: string | null,
): ChannelValueError | null => {
  const trimmed = value.trim();

  if (!trimmed) {
    return 'required';
  }

  if (channel === 'email') {
    if (!isValidEmail(trimmed)) {
      return 'invalid';
    }

    if (current && trimmed.toLowerCase() === current.toLowerCase()) {
      return 'unchanged';
    }

    return null;
  }

  const normalized = normalizePhoneNumber(trimmed);

  if (!phoneNumberSchema.safeParse(normalized).success) {
    return 'invalid';
  }

  if (current && normalized === normalizePhoneNumber(current)) {
    return 'unchanged';
  }

  return null;
};

/** Normalises a value for display once it's accepted. */
export const formatChannelValue = (
  channel: SignInChannel,
  value: string,
): string => (channel === 'phone' ? formatPhoneNumber(value) : value.trim());

// Only North American numbers get a canonical shape for now; anything else is
// shown as typed.
const formatPhoneNumber = (value: string): string => {
  const northAmerican = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(
    normalizePhoneNumber(value),
  );

  if (!northAmerican) {
    return value.trim();
  }

  const [, area, exchange, line] = northAmerican;
  return `+1-${area}-${exchange}-${line}`;
};
