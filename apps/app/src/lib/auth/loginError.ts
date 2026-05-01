import { APP_NAME } from '@op/core';

export const LOGIN_ERROR_CODES = [
  'not_invited',
  'invalid_email',
  'oauth_cancelled',
  'oauth_failed',
  'no_email',
  'unknown',
] as const;

export type LoginErrorCode = (typeof LOGIN_ERROR_CODES)[number];

export const isLoginErrorCode = (value: unknown): value is LoginErrorCode =>
  typeof value === 'string' &&
  (LOGIN_ERROR_CODES as readonly string[]).includes(value);

export const loginErrorMessages: Record<LoginErrorCode, string> = {
  not_invited: `${APP_NAME} is invite-only. You’re now on the waitlist — keep an eye on your inbox for updates.`,
  invalid_email:
    'We couldn’t read the email on your account. Please try a different sign-in method.',
  oauth_cancelled: 'Sign-in was cancelled. Please try again.',
  oauth_failed:
    'We couldn’t complete sign-in with your provider. Please try again.',
  no_email:
    'Your account didn’t share an email address. Please try a different sign-in method.',
  unknown: 'There was an error signing you in.',
};
