'use client';

import { CookieBanner } from '@op/sense/CookieBanner';
import { CookieBannerLink } from '@op/sense/CookieBannerLink';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useTrackingConsent } from '../PostHogProvider';

export const CookieConsentBanner = () => {
  const t = useTranslations();
  const { shouldPrompt, accept, reject } = useTrackingConsent();

  if (!shouldPrompt) {
    return null;
  }

  return (
    <CookieBanner
      title={t('Your Privacy')}
      description={t.rich(
        'We use essential cookies to make Common work, and analytics cookies to understand how the platform is used. Read our <privacy>Privacy Policy</privacy> and <terms>Terms of Use</terms> to learn more.',
        {
          privacy: (chunks: ReactNode) => (
            <PolicyLink href="/info/privacy">{chunks}</PolicyLink>
          ),
          terms: (chunks: ReactNode) => (
            <PolicyLink href="/info/tos">{chunks}</PolicyLink>
          ),
        },
      )}
      rejectLabel={t('Reject')}
      acceptLabel={t('Accept')}
      onReject={reject}
      onAccept={accept}
    />
  );
};

/**
 * Deliberately NOT the i18n `Link`, and deliberately not locale-prefixed. The
 * policy pages live at `/info/*`, outside the `[locale]` segment and outside
 * the proxy's matcher, which is what keeps them reachable without a session.
 * `/en/info/privacy` is not a route: it falls into the walled garden and
 * redirects to `/login`, so a visitor answering a cookie banner would be asked
 * to sign in to read the privacy policy.
 *
 * Same tab, not a new one: the banner is rendered by the root layout and the
 * answer is still pending after the navigation, so it's waiting when the
 * visitor comes back.
 */
const PolicyLink = ({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) => (
  <CookieBannerLink render={<a href={href} />}>{children}</CookieBannerLink>
);
