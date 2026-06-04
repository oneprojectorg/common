'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useEffect } from 'react';

import { useRouter } from '@/lib/i18n/routing';

interface OverviewRouteGuardProps {
  decisionSlug: string;
}

/**
 * Gates the whole (decision-view) branch behind the `decision_overview` flag.
 * Rendered in the group layout so it covers both /overview and /current: when
 * the flag is off, it redirects to the canonical decision root, which is still
 * served by the original (unflagged) page. Returns nothing — guard only.
 */
export function OverviewRouteGuard({ decisionSlug }: OverviewRouteGuardProps) {
  const overviewEnabled = useFeatureFlag('decision_overview');
  const router = useRouter();

  useEffect(() => {
    if (!overviewEnabled) {
      router.replace(`/decisions/${decisionSlug}`);
    }
  }, [overviewEnabled, decisionSlug, router]);

  return null;
}
