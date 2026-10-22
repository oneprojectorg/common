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
      title={t('auth.cookieConsentTitle')}
      description={t.rich('auth.cookieConsentBody', {
        privacy: (chunks: ReactNode) => (
          <PolicyLink href="/info/privacy" newTabLabel={t('shell.newTabHint')}>
            {chunks}
          </PolicyLink>
        ),
        terms: (chunks: ReactNode) => (
          <PolicyLink href="/info/tos" newTabLabel={t('shell.newTabHint')}>
            {chunks}
          </PolicyLink>
        ),
      })}
      rejectLabel={t('auth.cookieRejectAction')}
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
 * Opens in a new tab so reading a policy doesn't navigate away from whatever
 * the visitor came here to do, with the sighted-obvious "this leaves the page"
 * cue spelled out for screen readers.
 */
const PolicyLink = ({
  href,
  newTabLabel,
  children,
}: {
  href: string;
  newTabLabel: string;
  children: ReactNode;
}) => (
  <CookieBannerLink render={<a href={href} target="_blank" rel="noreferrer" />}>
    {children}
    <span className="sr-only"> {newTabLabel}</span>
  </CookieBannerLink>
);
