import { type ReactNode, Suspense } from 'react';

import { DecisionHeader } from '@/components/decisions/DecisionHeader';
import { DecisionSidePanel } from '@/components/decisions/DecisionSidePanel';
import { DecisionTranslationProvider } from '@/components/decisions/DecisionTranslationContext';
import { DecisionViewToggle } from '@/components/decisions/DecisionViewToggle';
import { JoinAccountModal } from '@/components/decisions/JoinAccountModal';
import { PromoteAccountModal } from '@/components/decisions/PromoteAccountModal';
import { TranslationDetectionProvider } from '@/components/decisions/TranslationDetectionContext';
import { hasFirstPhaseStarted } from '@/components/decisions/hasFirstPhaseStarted';

import { loadDecision } from './loadDecision';

/**
 * Shared shell for the overview and current-phase tabs. Living in a layout
 * means the header, the Overview / Current Phase toggle, and the updates side
 * panel persist across tab switches — the tab content is the only thing that
 * swaps, which is what makes the switch feel like a single page. The header and
 * toggle read everything they need from `loadDecision` (the single slug fetch,
 * enriched with `access` + encoded `instanceData`), so the layout makes no
 * separate `getInstance` call. The /current tab seeds its own `getInstance`
 * cache in its page.
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
  const instance = decisionProfile.processInstance;

  // The process is "active" once its first phase begins — read from the phases
  // loadDecision already returned (no separate getInstance fetch).
  const isActive = hasFirstPhaseStarted(instance?.instanceData?.phases);
  const access = instance?.access;
  // A viewer who can submit proposals without an account is on a "public"
  // process — the header offers Join (account claim) instead of Log in.
  const canJoin = access?.submitProposals === true;

  return (
    <DecisionTranslationProvider>
      {/* Detection spans the whole screen — the side panel's updates and
          resources register alongside the proposals and the phase copy, so one
          Translate control covers everything the screen can translate. */}
      <TranslationDetectionProvider>
        {/* Fixed header + scrolling content: the grid keeps the header in place
          and confines the scrollbar to the content row. The content row is the
          scroll container the proposals filter bar pins inside. */}
        <div className="grid h-dvh grid-rows-[auto_1fr]">
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
          {/* overflow-x-clip: the bar's full-bleed `w-screen` chrome is 100vw,
            which exceeds the content width by the scrollbar on desktop and would
            otherwise add a few px of horizontal scroll. */}
          <div className="overflow-x-clip overflow-y-auto">{children}</div>
        </div>
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
        {/*
         * Header "Join" modal (account claim on public processes). Mounted in the
         * layout like PromoteAccountModal so `?join=1` works on both tabs; reads
         * the param via nuqs, hence the Suspense (see the side panel comment).
         * Only mounted when the process is public — non-public pages hydrate
         * nothing.
         */}
        {canJoin ? (
          <Suspense fallback={null}>
            <JoinAccountModal />
          </Suspense>
        ) : null}
      </TranslationDetectionProvider>
    </DecisionTranslationProvider>
  );
};

export default DecisionViewLayout;
