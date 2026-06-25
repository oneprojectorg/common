'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { type ProcessPhase } from '@op/api/encoders';
import { Button, ButtonLink } from '@op/ui/Button';
import { EmptyState } from '@op/ui/EmptyState';
import { Header2, Header3 } from '@op/ui/Header';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import he from 'he';
import { Suspense, type ReactNode } from 'react';
import { LuTriangleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { DecisionPhaseTimeline } from './DecisionPhaseTimeline';
import {
  OverviewPinnedResourcesSuspense,
  PinnedResourcesError,
  PinnedResourcesSkeleton,
} from './OverviewPinnedResources';
import { useCreateProposal } from './useCreateProposal';

interface DecisionOverviewProps {
  instanceId: string;
  decisionSlug: string;
  /**
   * The "About" body, pre-rendered on the server (RSC) from the overview's
   * TipTap JSON via RichTextRenderer, so the prose ships as server HTML with no
   * client JS. Null when there's no body (falls back to the plain description).
   */
  aboutSlot?: ReactNode;
  /**
   * Whether the process is active, i.e. its first phase has begun. Computed
   * server-side (RSC) on the page; the proposal CTAs stay hidden until then.
   * See hasFirstPhaseStarted.
   */
  isActive: boolean;
}

/**
 * Overview tab for a decision process (/decisions/[slug]/overview). The shared
 * header + view toggle come from the (decision-view) layout; this renders the
 * hero, the phases sidebar slot, and the About body.
 *
 * Overview content (headline, description, body HTML) comes from
 * `instanceData.overview`, authored in the process builder's Overview tab.
 * Falls back to the instance name/description for processes authored before
 * that tab was filled in.
 */
export function DecisionOverviewSuspense({
  instanceId,
  decisionSlug,
  aboutSlot,
  isActive,
}: DecisionOverviewProps) {
  const t = useTranslations();

  return (
    <APIErrorBoundary
      fallbacks={{
        default: () => (
          <EmptyState icon={<LuTriangleAlert className="size-6" />}>
            <Header3 className="font-serif font-light">
              {t("Couldn't load the overview")}
            </Header3>
            <p className="text-base text-neutral-charcoal">
              {t('Refresh the page to try again.')}
            </p>
          </EmptyState>
        ),
      }}
    >
      <DecisionOverviewContent
        instanceId={instanceId}
        decisionSlug={decisionSlug}
        aboutSlot={aboutSlot}
        isActive={isActive}
      />
    </APIErrorBoundary>
  );
}

function DecisionOverviewContent({
  instanceId,
  decisionSlug,
  aboutSlot,
  isActive,
}: DecisionOverviewProps) {
  const t = useTranslations();
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });

  const overview = instance.instanceData?.overview;
  const headline = overview?.headline || instance.name;
  const profileId = instance.profileId;

  // Same gate as StandardDecisionPage: the phase must accept proposals and
  // the viewer must have submit access.
  const currentPhase = instance.instanceData?.phases?.find(
    (p) => p.phaseId === instance.currentStateId,
  );
  const canSubmitProposal =
    currentPhase?.rules?.proposals?.submit === true &&
    instance.access?.submitProposals === true;

  const phases: ProcessPhase[] = (instance.instanceData?.phases ?? []).map(
    (p) => ({
      id: p.phaseId,
      name: p.name || '',
      description: p.description,
      phase: { startDate: p.startDate, endDate: p.endDate },
      advancementMethod: p.rules?.advancement?.method,
      config: { allowProposals: p.rules?.proposals?.submit },
    }),
  );

  const currentPhaseId = currentPhase?.phaseId || '';

  return (
    <div className="flex w-full flex-col">
      <OverviewHero
        headline={headline}
        subhead={overview?.description}
        instanceId={instanceId}
        decisionSlug={decisionSlug}
        canSubmitProposal={canSubmitProposal}
        // Hidden until the first phase begins (computed server-side).
        showCtas={isActive}
      />
      {/* 12-col grid mirroring the Figma layout grid: sidebar spans 4 cols,
          body spans 7 starting at col 6. Stacks to one column below md. */}
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-12 px-4 py-6 md:grid-cols-12 md:gap-x-6 md:px-6 md:py-12">
        <div className="flex flex-col gap-6 md:col-span-4">
          <div className="flex flex-col gap-4">
            <Header3 className="font-sans text-sm text-neutral-gray4">
              {t('Process Overview')}
            </Header3>
            <DecisionPhaseTimeline
              phases={phases}
              currentPhaseId={isActive ? currentPhaseId : ''}
              instanceId={instanceId}
              isAdmin={instance.access?.admin}
              decisionSlug={decisionSlug}
            />
          </div>
          {/* Pinned resources sit below the phase timeline. Their own boundary
              keeps a load failure scoped to this section (a small message)
              instead of tripping the page-level error boundary. */}
          {profileId ? (
            <APIErrorBoundary
              fallbacks={{ default: () => <PinnedResourcesError /> }}
            >
              <Suspense fallback={<PinnedResourcesSkeleton />}>
                <OverviewPinnedResourcesSuspense profileId={profileId} />
              </Suspense>
            </APIErrorBoundary>
          ) : null}
        </div>
        <div className="min-w-0 md:col-span-7 md:col-start-6">
          <OverviewAbout
            bodySlot={aboutSlot}
            fallbackText={instance.description ?? undefined}
          />
        </div>
      </div>
    </div>
  );
}

const OverviewHero = ({
  headline,
  subhead,
  instanceId,
  decisionSlug,
  canSubmitProposal,
  showCtas,
}: {
  headline: string;
  subhead?: string;
  instanceId: string;
  decisionSlug: string;
  canSubmitProposal: boolean;
  showCtas: boolean;
}) => {
  const t = useTranslations();
  const currentPhaseHref = `/decisions/${decisionSlug}/current`;
  const { createProposal, isCreating, isReady } = useCreateProposal({
    instanceId,
    navigateTo: (proposal) =>
      `/decisions/${decisionSlug}/proposal/${proposal.profileId}/edit`,
    canSubmitProposal,
  });

  return (
    // Gradient stands in until overview header images exist — same radial
    // gradient as the results page hero.
    <section className="grid w-full grid-cols-1 justify-center gap-12 bg-redPurple md:grid-cols-12">
      <div className="mx-auto flex flex-col items-center gap-4 px-4 pt-16 pb-8 text-center text-neutral-offWhite sm:py-24 md:col-span-6 md:col-start-4 md:px-6">
        <div className="flex flex-col items-center gap-2">
          <h1 className="font-serif text-title-xl font-light sm:text-title-xxl">
            <bdi>{headline}</bdi>
          </h1>
          {subhead ? (
            <p dir="auto" className="text-base">
              {subhead}
            </p>
          ) : null}
        </div>
        {showCtas ? (
          <div className="align-stretch flex w-full flex-col gap-4 md:flex-row md:justify-center">
            <ButtonLink
              color="secondary"
              href={currentPhaseHref}
              className="w-auto"
            >
              {t('Browse proposals')}
            </ButtonLink>
            {canSubmitProposal ? (
              <Button
                color="primary"
                className="w-auto"
                isDisabled={!isReady || isCreating}
                onPress={createProposal}
              >
                {isCreating ? <LoadingSpinner /> : null}
                {t('Start a proposal')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
};

const OverviewAbout = ({
  bodySlot,
  fallbackText,
}: {
  /** Server-rendered overview body (RSC). Null when there's no body. */
  bodySlot?: ReactNode;
  /** Plain-text process description shown when no overview body exists. */
  fallbackText?: string;
}) => {
  const t = useTranslations();

  // Prefer the server-rendered body; otherwise fall back to the plain-text
  // description (entity-encoded for some orgs, same as DecisionActionBar —
  // decode and render as text, not HTML).
  let body: ReactNode = null;
  if (bodySlot) {
    body = bodySlot;
  } else if (fallbackText) {
    body = (
      <p dir="auto" className="text-base">
        {he.decode(fallbackText)}
      </p>
    );
  }

  if (!body) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4">
      <Header2 className="font-serif">{t('About the process')}</Header2>
      {body}
    </section>
  );
};
