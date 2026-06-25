import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import { type ReactNode, Suspense } from 'react';

import { DecisionHeader } from '@/components/decisions/DecisionHeader';
import { DecisionSidePanel } from '@/components/decisions/DecisionSidePanel';
import { DecisionTranslationProvider } from '@/components/decisions/DecisionTranslationContext';
import { DecisionViewToggle } from '@/components/decisions/DecisionViewToggle';
import { hasFirstPhaseStarted } from '@/components/decisions/hasFirstPhaseStarted';

import { loadDecision } from './loadDecision';

/**
 * Shared shell for the overview and current-phase tabs. Living in a layout
 * means the header, the Overview / Current Phase toggle, and the updates side
 * panel persist across tab switches — the tab content is the only thing that
 * swaps, which is what makes the switch feel like a single page. The instance
 * is prefetched once here so both tabs' client suspense reads resolve from a
 * warm cache.
 */
const DecisionViewLayout = async ({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string; locale: string }>;
}) => {
  const { slug } = await params;

  const { decisionProfile, instanceId } = await loadDecision(slug);
  const { utils, queryClient } = await createServerUtils();

  // Fetch (not prefetch) so we can read the phases server-side to gate the
  // toggle, while still seeding the cache the client suspense reads hydrate
  // from. The process is "active" once its first phase begins. Fail open if it
  // throws — the child suspense reads drive the error UX.
  let isActive = true;
  try {
    const instance = await utils.decision.getInstance.fetch({ instanceId });
    isActive = hasFirstPhaseStarted(instance.instanceData?.phases);
  } catch {
    isActive = true;
  }

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
          // Hidden until the first phase begins.
          centerSlot={
            isActive ? <DecisionViewToggle decisionSlug={slug} /> : undefined
          }
        />
        {children}
        {/*
         * Like the header's updates toggle, the side panel reads the `panel`
         * search param (nuqs/useSearchParams). It lives in this layout, which
         * Next prerenders as the route's static shell (see loading.tsx), so the
         * read would happen outside a request scope and throw. Suspense defers
         * it out of the shell; the panel is closed by default, so null fallback.
         */}
        <Suspense fallback={null}>
          <DecisionSidePanel
            decisionProfileId={decisionProfile.id}
            access={access}
          />
        </Suspense>
      </DecisionTranslationProvider>
    </HydrationBoundary>
  );
};

export default DecisionViewLayout;
