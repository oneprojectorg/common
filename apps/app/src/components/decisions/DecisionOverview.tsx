'use client';

import { getPublicUrl } from '@/utils';
import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { type ProcessInstance, type ProcessPhase } from '@op/api/encoders';
import { Avatar } from '@op/ui/Avatar';
import { Button, ButtonLink } from '@op/ui/Button';
import { EmptyState } from '@op/ui/EmptyState';
import { GradientHeader, Header1, Header3 } from '@op/ui/Header';
import { Link } from '@op/ui/Link';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import he from 'he';
import Image from 'next/image';
import { Suspense, type ReactNode } from 'react';
import { LuBookOpen, LuTriangleAlert } from 'react-icons/lu';

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
   * The decision's process instance, fetched once on the server via
   * loadDecision (getDecisionBySlug, enriched by the router with `access` +
   * encoded `instanceData`). Passed as a prop so the overview renders from the
   * single slug fetch the route already makes — no client `getInstance` query.
   */
  processInstance: ProcessInstance;
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
 * Overview view for a decision process (/decisions/[slug]). The shared
 * header + view toggle come from the (decision-view) layout; this renders the
 * hero, the phases sidebar slot, and the About body.
 *
 * Overview content (headline, description, body HTML) comes from
 * `instanceData.overview`, authored in the process builder's Overview tab.
 * Falls back to the instance name/description for processes authored before
 * that tab was filled in.
 */
// Renders from server-fetched props (no useSuspenseQuery), so it does not
// suspend — no `Suspense` suffix. Keeps the page-level APIErrorBoundary as a
// defensive catch for render errors.
export function DecisionOverview({
  instanceId,
  decisionSlug,
  processInstance,
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
        processInstance={processInstance}
        aboutSlot={aboutSlot}
        isActive={isActive}
      />
    </APIErrorBoundary>
  );
}

function DecisionOverviewContent({
  instanceId,
  decisionSlug,
  processInstance: instance,
  aboutSlot,
  isActive,
}: DecisionOverviewProps) {
  const t = useTranslations();

  const overview = instance.instanceData?.overview;
  const headline = overview?.headline || instance.name;
  const profileId = instance.profileId;

  // Header meta row: prefer the steward, fall back to the owner (same rule as
  // DecisionListItem). "Open for learning" shows only for public processes;
  // private processes hide the badge entirely.
  const steward = instance.steward ?? instance.owner;
  const isPublic = !instance.instanceData?.config?.isPrivate;

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
        steward={steward}
        isPublic={isPublic}
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
  steward,
  isPublic,
  instanceId,
  decisionSlug,
  canSubmitProposal,
  showCtas,
}: {
  headline: string;
  subhead?: string;
  steward: ProcessInstance['steward'];
  isPublic: boolean;
  instanceId: string;
  decisionSlug: string;
  canSubmitProposal: boolean;
  showCtas: boolean;
}) => {
  const t = useTranslations();
  const stewardName = steward?.name;
  const currentPhaseHref = `/decisions/${decisionSlug}/current`;
  const { createProposal, isCreating, isReady } = useCreateProposal({
    instanceId,
    navigateTo: (proposal) =>
      `/decisions/${decisionSlug}/proposal/${proposal.profileId}/edit`,
    canSubmitProposal,
  });

  return (
    // Light banner stands in for the header image. When the
    // upload ships, drop an absolutely-positioned <Image fill> (from
    // profile.headerImage) behind this content and keep the gradient as the
    // empty-state fallback.
    <section className="grid w-full grid-cols-1 justify-center border-b bg-neutral-offWhite md:grid-cols-12">
      <div className="mx-auto flex flex-col items-center gap-4 px-4 pt-16 pb-8 text-center sm:py-12 md:col-span-6 md:col-start-4 md:px-6">
        <div className="flex flex-col items-center gap-3">
          {/* Brand teal→green gradient clipped to the title text. This hero is
              the page's <h1>; the sticky DecisionInstanceHeader carries a
              secondary <h2>, so there's exactly one <h1> and tests can target
              the banner headline unambiguously with `level: 1`. */}
          <GradientHeader>
            <Header1 className="md:text-title-xxl">
              <bdi>{headline}</bdi>
            </Header1>
          </GradientHeader>
          {stewardName || isPublic ? (
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-neutral-charcoal">
              {stewardName ? (
                <span className="flex items-center gap-1.5">
                  <Avatar placeholder={stewardName} className="size-5">
                    {steward?.avatarImage?.name ? (
                      <Image
                        src={getPublicUrl(steward.avatarImage.name) ?? ''}
                        alt={stewardName}
                        fill
                        className="object-cover"
                      />
                    ) : null}
                  </Avatar>
                  <span>
                    {t('Stewarded by')}{' '}
                    {steward?.slug ? (
                      // Underline keeps the link distinguishable from
                      // surrounding text without relying on color alone —
                      // axe's `link-in-text-block` flags color-only cues.
                      <Link
                        href={`/profile/${steward.slug}`}
                        className="underline"
                      >
                        {stewardName}
                      </Link>
                    ) : (
                      stewardName
                    )}
                  </span>
                </span>
              ) : null}
              {stewardName && isPublic ? (
                <span aria-hidden="true" className="text-neutral-gray4">
                  •
                </span>
              ) : null}
              {isPublic ? (
                <span className="flex items-center gap-1.5">
                  <LuBookOpen className="size-4" aria-hidden="true" />
                  {t('Open for learning')}
                </span>
              ) : null}
            </div>
          ) : null}
          {subhead ? (
            <p
              dir="auto"
              className="text-base text-balance text-neutral-charcoal"
            >
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

  return body;
};
