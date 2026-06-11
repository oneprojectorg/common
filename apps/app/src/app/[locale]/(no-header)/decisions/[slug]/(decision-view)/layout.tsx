import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import { type ReactNode } from 'react';

import { getServerFeatureFlag } from '@/lib/getServerFeatureFlag';
import { redirect } from '@/lib/i18n/routing';

import { DecisionHeader } from '@/components/decisions/DecisionHeader';
import { DecisionSidePanel } from '@/components/decisions/DecisionSidePanel';
import { DecisionTranslationProvider } from '@/components/decisions/DecisionTranslationContext';
import { DecisionViewToggle } from '@/components/decisions/DecisionViewToggle';

import { loadDecision } from './loadDecision';

/**
 * Shared shell for the overview and current-phase tabs. Living in a layout
 * means the header, the Overview / Current Phase toggle, and the updates side
 * panel persist across tab switches — the tab content is the only thing that
 * swaps, which is what makes the switch feel like a single page. The instance
 * is prefetched once here so both tabs' client suspense reads resolve from a
 * warm cache.
 *
 * This whole branch is gated by the `decision_overview` flag, evaluated
 * server-side so flag-off visitors are redirected to the canonical root (the
 * original, unflagged page) before anything renders — no client flash.
 */
const DecisionViewLayout = async ({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string; locale: string }>;
}) => {
  const { slug, locale } = await params;

  if (!(await getServerFeatureFlag('decision_overview'))) {
    redirect({ href: `/decisions/${slug}`, locale });
  }

  const { decisionProfile, instanceId } = await loadDecision(slug);
  const { utils, queryClient } = await createServerUtils();

  await utils.decision.getInstance.prefetch({ instanceId });

  const access = decisionProfile.processInstance?.access;

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DecisionTranslationProvider>
        <DecisionHeader
          instanceId={instanceId}
          decisionSlug={slug}
          isAdmin={access?.admin}
          canReadUpdates={access?.admin === true || access?.read === true}
          profileName={decisionProfile.name}
          showStepper={false}
          centerSlot={<DecisionViewToggle decisionSlug={slug} />}
        />
        {children}
        <DecisionSidePanel
          decisionProfileId={decisionProfile.id}
          access={access}
        />
      </DecisionTranslationProvider>
    </HydrationBoundary>
  );
};

export default DecisionViewLayout;
