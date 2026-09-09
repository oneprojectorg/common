'use client';

import { Button } from '@op/sense/Button';

import { useTranslations } from '@/lib/i18n';

import { useTrackingConsent } from '../PostHogProvider';

/**
 * Persistent analytics-consent toast. It has no auto-dismiss and no close
 * affordance on purpose: it stays until the visitor answers, and posthog-js
 * remembers the answer across reloads.
 *
 * It is not raised through the `@op/sense` toast manager — that surface is for
 * transient notifications that stack, auto-expire and can be swiped away, none
 * of which a consent prompt may do. It sits on the opposite side of the viewport
 * from the toast viewport (`sm:right-4`) so the two don't collide.
 */
export const ConsentToast = () => {
  const t = useTranslations();
  const { status, accept, reject } = useTrackingConsent();

  if (status !== 'pending') {
    return null;
  }

  return (
    <div
      role="region"
      aria-label={t('Analytics consent')}
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-sm flex-col gap-3 rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg sm:start-4 sm:end-auto sm:mx-0 sm:w-full"
    >
      <div className="flex flex-col gap-1">
        <p className="text-base font-strong">{t('Help us improve Common')}</p>
        <p className="text-sm text-muted-foreground">
          {t(
            "Accept cookies to help us measure how Common is used. Reject and we'll still count your visit anonymously, without cookies.",
          )}
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={accept}>
          {t('Accept')}
        </Button>
        <Button size="sm" variant="outline" onClick={reject}>
          {t('Reject')}
        </Button>
      </div>
    </div>
  );
};
