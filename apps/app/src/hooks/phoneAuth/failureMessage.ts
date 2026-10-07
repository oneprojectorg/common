import type { TranslateFn } from '@/lib/i18n';

import type { PhoneCodeFailure, PhoneVerifyFailure } from './types';

/**
 * Turns a failure reason into copy a person can act on.
 *
 * The reasons are closed sets, so a new one fails the exhaustiveness check
 * here rather than silently reading as "wrong code" — which is how a correct
 * code once produced "That code was wrong. Try again." The copy names no
 * channel, so the email-code and phone-code screens share it.
 */
export const codeFailureMessage = (
  reason: PhoneCodeFailure | PhoneVerifyFailure,
  // The root translator, not a namespaced one: `ReturnType<typeof
  // useTranslations>` now widens to every namespace's keys at once, which no
  // caller can satisfy.
  t: TranslateFn,
): string => {
  switch (reason) {
    case 'expired':
      return t('auth.codeExpiredError');
    case 'wrong_code':
      return t('auth.codeIncorrectError');
    case 'rate_limited':
      return t('auth.tooManyAttemptsError');
    case 'unavailable':
      return t('auth.smsUnavailableError');
    case 'unknown':
      return t('auth.codeSendError');
  }
};
