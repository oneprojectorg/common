import type { AuthCodeEmailCopy, FallbackSendResult } from '@op/emails';

import {
  type SupportedLocale,
  getLocaleDirection,
} from '../translation/locales';

/** Sends a sign-in or confirmation code, through the fallback transport if needed. */
export const sendAuthCodeEmail = async ({
  to,
  code,
  locale,
  subject,
  copy,
}: {
  to: string;
  code: string;
  locale: SupportedLocale;
  subject: string;
  copy: AuthCodeEmailCopy;
}): Promise<FallbackSendResult> => {
  // Use dynamic imports to avoid build issues with workspace dependencies
  const { AuthCodeEmail, OPNodemailerWithFallback } = await import(
    '@op/emails'
  );

  return OPNodemailerWithFallback({
    to,
    subject,
    component: () =>
      AuthCodeEmail({
        code,
        lang: locale,
        dir: getLocaleDirection(locale),
        copy,
      }),
  });
};
