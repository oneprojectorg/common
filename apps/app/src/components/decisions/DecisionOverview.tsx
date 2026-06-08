'use client';

import { trpc } from '@op/api/client';
import { Header1 } from '@op/ui/Header';

import { useTranslations } from '@/lib/i18n';

interface DecisionOverviewProps {
  instanceId: string;
  slug: string;
  decisionSlug?: string;
  decisionProfileId?: string | null;
}

/**
 * Overview tab for a decision process. Rendered at the decision root
 * (/decisions/[slug]) by DecisionRootView when the overview flag is on; the
 * current phase moves to /current.
 *
 * Scaffold: renders the instance title + a placeholder body. Flesh out with
 * the full process summary (hero, proposals, phases, About) next.
 */
export function DecisionOverviewSuspense({
  instanceId,
}: DecisionOverviewProps) {
  const t = useTranslations();
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-6 py-8 text-center">
      <Header1>{instance.name ?? t('Overview')}</Header1>
      <p>{instance.description}</p>
    </div>
  );
}
