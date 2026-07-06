import { type ReactNode, Suspense } from 'react';

import { DecisionHeader } from '@/components/decisions/DecisionHeader';
import { DecisionSidePanel } from '@/components/decisions/DecisionSidePanel';
import { DecisionTranslationProvider } from '@/components/decisions/DecisionTranslationContext';
import { DecisionViewToggle } from '@/components/decisions/DecisionViewToggle';
import { PromoteAccountModal } from '@/components/decisions/PromoteAccountModal';
import { hasFirstPhaseStarted } from '@/components/decisions/hasFirstPhaseStarted';
import { DecisionHeaderBarSkeleton } from '@/components/skeletons/DecisionSkeleton';

import { loadDecision } from './loadDecision';

type DecisionViewParams = Promise<{ slug: string; locale: string }>;

/**
 * Shared shell for the overview and current-phase tabs. Living in a layout
 * means the header, the Overview / Current Phase toggle, and the updates side
 * panel persist across tab switches — the tab content is the only thing that
 * swaps, which is what makes the switch feel like a single page.
 *
 * The layout itself awaits nothing, so the shell (and each tab's loading.tsx
 * skeleton) paints immediately on first navigation. The header and side panel
 * each await `loadDecision` inside their own Suspense below — that's the same
 * React-cached slug fetch the page makes, so everything still rides on one
 * request and streams in together when it resolves.
 */
const DecisionViewLayout = ({
  children,
  params,
}: {
  children: ReactNode;
  params: DecisionViewParams;
}) => {
  return (
    <DecisionTranslationProvider>
      {/* Fixed header + scrolling content: the grid keeps the header in place
          and confines the scrollbar to the content row. The content row is the
          scroll container the proposals filter bar pins inside. */}
      <div className="grid h-dvh grid-rows-[auto_1fr]">
        {/* Grid contract: this Suspense (and the resolved header) must stay a
            single grid item — a second top-level element (e.g. flipping
            showStepper back on) would steal the 1fr row from the content. */}
        <Suspense fallback={<DecisionHeaderBarSkeleton />}>
          <DecisionViewHeader params={params} />
        </Suspense>
        {/* overflow-x-clip: the bar's full-bleed `w-screen` chrome is 100vw,
            which exceeds the content width by the scrollbar on desktop and would
            otherwise add a few px of horizontal scroll. */}
        <div className="overflow-x-clip overflow-y-auto">{children}</div>
      </div>
      {/*
       * Like the header's updates toggle, the side panel reads the `panel`
       * search param (nuqs/useSearchParams), which must stay out of the
       * route's static shell (the read would happen outside a request scope
       * and throw). Suspense defers it — and lets the loader await
       * loadDecision without blocking the shell; the panel is closed by
       * default, so null fallback.
       */}
      <Suspense fallback={null}>
        <DecisionSidePanelLoader params={params} />
      </Suspense>
      {/*
       * Post-anon-submit promote modal. Mounted here (not on the deleted
       * `/decisions/[slug]/page.tsx` from #1458) so the `?promote=1` redirect
       * the proposal editor issues still opens the modal regardless of whether
       * the user lands on the overview or the current-phase tab. Reads
       * `?promote=` via nuqs and renders null when the param is absent.
       */}
      <Suspense fallback={null}>
        <PromoteAccountModal />
      </Suspense>
    </DecisionTranslationProvider>
  );
};

/**
 * Header + view toggle, streamed in once loadDecision resolves. Reads
 * everything it needs from the single slug fetch (enriched with `access` +
 * encoded `instanceData`), so no separate `getInstance` call. The /current tab
 * seeds its own `getInstance` cache in its page.
 */
const DecisionViewHeader = async ({
  params,
}: {
  params: DecisionViewParams;
}) => {
  const { slug } = await params;
  const { decisionProfile, instanceId } = await loadDecision(slug);
  const instance = decisionProfile.processInstance;

  // The process is "active" once its first phase begins — read from the phases
  // loadDecision already returned (no separate getInstance fetch).
  const isActive = hasFirstPhaseStarted(instance?.instanceData?.phases);
  const access = instance?.access;

  return (
    <DecisionHeader
      instanceId={instanceId}
      decisionSlug={slug}
      isAdmin={access?.admin}
      canReadUpdates={access?.admin === true || access?.read === true}
      profileName={decisionProfile.name}
      // Pass the instance so the header renders from props (no client
      // getInstance query on this route).
      processInstance={instance}
      showStepper={false}
      // Hidden until the first phase begins.
      centerSlot={
        isActive ? <DecisionViewToggle decisionSlug={slug} /> : undefined
      }
    />
  );
};

/** Awaits the shared loadDecision fetch for the updates side panel. */
const DecisionSidePanelLoader = async ({
  params,
}: {
  params: DecisionViewParams;
}) => {
  const { slug } = await params;
  const { decisionProfile } = await loadDecision(slug);

  return (
    <DecisionSidePanel
      decisionProfileId={decisionProfile.id}
      access={decisionProfile.processInstance?.access}
    />
  );
};

export default DecisionViewLayout;
