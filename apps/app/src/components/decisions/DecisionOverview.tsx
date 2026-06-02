'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { trpc } from '@op/api/client';
import { useEffect } from 'react';

import { useTranslations } from '@/lib/i18n';
import { useRouter } from '@/lib/i18n/routing';

interface DecisionOverviewProps {
  instanceId: string;
  slug: string;
  decisionSlug?: string;
  decisionProfileId?: string | null;
}

/**
 * Overview view for a decision process. Lives at
 * /decisions/[slug]/overview as a sibling of the current-phase view
 * (rendered by DecisionStateRouter at the base route).
 *
 * Scaffold: renders the instance title + a placeholder body. Flesh out
 * with the full process summary (phases, proposals, outcomes) next.
 */
export function DecisionOverview({
  instanceId,
  decisionSlug,
}: DecisionOverviewProps) {
  const t = useTranslations();
  const router = useRouter();
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });

  // The route resolves on a direct URL even when the feature is off (the
  // toggle that links here is hidden, but the page is still reachable).
  // Send those visitors back to the current-phase view.
  const overviewEnabled = useFeatureFlag('decision_overview');
  useEffect(() => {
    if (!overviewEnabled && decisionSlug) {
      router.replace(`/decisions/${decisionSlug}`);
    }
  }, [overviewEnabled, decisionSlug, router]);

  if (!overviewEnabled) {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <h2 className="text-title-lg">{t('Overview')}</h2>
      <p className="text-sm text-neutral-gray3">
        {instance.name ?? t('Decision overview')}
      </p>
    </div>
  );
}
