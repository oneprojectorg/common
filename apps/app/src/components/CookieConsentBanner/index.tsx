'use client';

import { CookieBanner } from '@op/sense/CookieBanner';
import { CookieBannerLink } from '@op/sense/CookieBannerLink';
import type { ReactNode } from 'react';

import { Link, useTranslations } from '@/lib/i18n';

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

// Same tab, not a new one: the banner is rendered by the root layout and the
// answer is still pending after the navigation, so it's waiting when the
// visitor comes back.
const PolicyLink = ({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) => (
  <CookieBannerLink render={<Link href={href} />}>{children}</CookieBannerLink>
);
