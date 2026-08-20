'use client';

import { useCanLinkToProfile } from '@/hooks/useCanLinkToProfile';
import { getPublicUrl } from '@/utils';
import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { type ProcessInstance, type ProcessPhase } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { Avatar, AvatarFallback, AvatarImage } from '@op/sense/Avatar';
import { Button } from '@op/sense/Button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { GradientHeader, Header1, Header3 } from '@op/sense/Header';
import { Spinner } from '@op/sense/Spinner';
import { cn } from '@op/sense/lib/utils';
import he from 'he';
import { Suspense, type ReactNode, useMemo } from 'react';
import { LuBookOpen, LuTriangleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

import { ButtonLink } from '@/components/ButtonLink';

import { DecisionHeroBackgroundImage } from './DecisionHeroBanner';
import { DecisionPhaseTimeline } from './DecisionPhaseTimeline';
import { useDecisionTranslation } from './DecisionTranslationContext';
import { EditBannerModal } from './EditBannerModal';
import {
  OverviewPinnedResourcesSuspense,
  PinnedResourcesError,
  PinnedResourcesSkeleton,
} from './OverviewPinnedResources';
import { ProposalHtmlContent } from './ProposalHtmlContent';
import { TranslateBanner } from './TranslateBanner';
import {
  useDecisionNeedsTranslation,
  useRegisterTranslationSamples,
} from './TranslationDetectionContext';
import { TranslationNotice } from './TranslationNotice';
import { getOverviewDetectionText } from './translationDetectionText';
import { useCreateProposal } from './useCreateProposal';
import { useTranslateDecision } from './useTranslateDecision';

// Stable empty array: the overview has no proposals to translate, and a fresh
// [] each render would churn useTranslateDecision's memoized callbacks.
const NO_PROPOSALS: Proposal[] = [];

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
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LuTriangleAlert className="size-6" />
              </EmptyMedia>
              <EmptyTitle className="font-light">
                {t("Couldn't load the overview")}
              </EmptyTitle>
              <EmptyDescription className="text-base text-foreground">
                {t('Refresh the page to try again.')}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
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

  // Translation: the banner offers to translate the overview into the viewer's
  // locale. translateDecision returns the authored overview fields, which we
  // prefer over the source content once present. Empty proposals here — the
  // overview has none; handleTranslate skips the proposal batch.
  const translation = useDecisionTranslation();

  const overview = instance.instanceData?.overview;

  // Register the authored overview as this screen's own detection sample. The
  // side panel's updates and resources register separately, so the banner
  // appears when any of them is in a language other than the reader's locale.
  const detectionSamples = useMemo(
    () => [
      getOverviewDetectionText({
        headline: overview?.headline ?? instance.name,
        description: overview?.description ?? instance.description ?? undefined,
        body: overview?.body,
      }),
    ],
    [overview, instance.name, instance.description],
  );

  useRegisterTranslationSamples('overview', detectionSamples);
  const needsTranslation = useDecisionNeedsTranslation();

  const decisionTranslation = useTranslateDecision({
    proposals: NO_PROPOSALS,
    decisionProfileId: instance.profileId,
    needsTranslation,
  });

  const headline =
    translation?.overviewHeadline || overview?.headline || instance.name;
  const subhead = translation?.overviewDescription ?? overview?.description;
  const profileId = instance.profileId;

  // Once translated, swap the server-rendered About body for the translated
  // HTML (rendered client-side, same as the proposal view).
  const translatedAbout = translation?.overviewBody ? (
    <ProposalHtmlContent html={translation.overviewBody} />
  ) : null;

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
        subhead={subhead}
        steward={steward}
        isPublic={isPublic}
        instanceId={instanceId}
        decisionSlug={decisionSlug}
        canSubmitProposal={canSubmitProposal}
        heroImagePath={overview?.heroImage}
        isAdmin={instance.access?.admin === true}
        // Hidden until the first phase begins (computed server-side).
        showCtas={isActive}
      />
      {/* 12-col grid mirroring the Figma layout grid: sidebar spans 4 cols,
          body spans 7 starting at col 6. Stacks to one column below md. */}
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-12 px-4 py-6 md:grid-cols-12 md:gap-x-6 md:px-6 md:py-12">
        <div className="flex flex-col gap-6 md:col-span-4">
          <div className="flex flex-col gap-4">
            <Header3 className="font-sans text-sm text-muted-foreground">
              {t('Process Overview')}
            </Header3>
            <DecisionPhaseTimeline
              phases={phases}
              // Always the real current phase — the advance flow derives the
              // next phase from it. `hasStarted` decides presentation: before the
              // first phase begins nothing reads as current, but an admin can
              // still advance. (Blanking the id here instead made `currentIndex`
              // -1, so nothing was advanceable at all.)
              currentPhaseId={currentPhaseId}
              hasStarted={isActive}
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
          {decisionTranslation.translationState ? (
            <TranslationNotice
              sourceLanguageName={decisionTranslation.sourceLanguageName}
              onViewOriginal={decisionTranslation.handleViewOriginal}
              className="mb-4"
            />
          ) : null}
          <OverviewAbout
            bodySlot={translatedAbout ?? aboutSlot}
            fallbackText={
              translation?.description ?? instance.description ?? undefined
            }
          />
        </div>
      </div>
      {decisionTranslation.showBanner ? (
        <TranslateBanner
          onTranslate={decisionTranslation.handleTranslate}
          onDismiss={decisionTranslation.dismissBanner}
          isTranslating={decisionTranslation.isTranslating}
          languageName={decisionTranslation.targetLanguageName}
        />
      ) : null}
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
  heroImagePath,
  isAdmin,
  showCtas,
}: {
  headline: string;
  subhead?: string;
  steward: ProcessInstance['steward'];
  isPublic: boolean;
  instanceId: string;
  decisionSlug: string;
  canSubmitProposal: boolean;
  /** Stored storage path of the admin-uploaded hero image, if any. */
  heroImagePath?: string;
  /** Admins see the desktop "Edit banner" control on the hero. */
  isAdmin: boolean;
  showCtas: boolean;
}) => {
  const t = useTranslations();
  const canLinkToProfile = useCanLinkToProfile();
  const stewardName = steward?.name;
  // Only link out to the steward's profile inside the walled garden — public
  // (non-network-member) viewers can't reach /profile, so render plain text.
  const canLinkToSteward = canLinkToProfile && Boolean(steward?.slug);
  const currentPhaseHref = `/decisions/${decisionSlug}/current`;
  const heroImageUrl = getPublicUrl(heroImagePath);
  // With a photo behind it, the clipped teal→green title and charcoal body lose
  // contrast — switch the hero text to white over a darker scrim. Buttons keep
  // their own colors.
  const hasImage = Boolean(heroImageUrl);
  const { createProposal, isCreating, isReady } = useCreateProposal({
    instanceId,
    navigateTo: (proposal) =>
      `/decisions/${decisionSlug}/proposal/${proposal.profileId}/edit`,
    canSubmitProposal,
  });

  return (
    // Admin-uploaded background sits behind the content as an <Image fill>; the
    // offWhite gradient is the empty-state fallback when no image is set.
    <section className="relative grid w-full grid-cols-1 justify-center overflow-hidden border-b bg-muted md:grid-cols-12">
      {heroImageUrl ? (
        <DecisionHeroBackgroundImage imageUrl={heroImageUrl} />
      ) : null}
      {isAdmin ? (
        <EditBannerModal
          instanceId={instanceId}
          heroImagePath={heroImagePath}
        />
      ) : null}
      <div className="relative z-10 mx-auto flex flex-col items-center gap-8 px-4 pt-16 pb-8 text-center md:col-span-6 md:col-start-4 md:px-6 md:pb-16">
        <div className="flex flex-col items-center gap-3">
          {/* Brand teal→green gradient clipped to the title text. This hero is
              the page's <h1>; the sticky DecisionInstanceHeader carries a
              secondary <h2>, so there's exactly one <h1> and tests can target
              the banner headline unambiguously with `level: 1`.
              Over a banner image the clipped gradient loses contrast against
              the dark scrim, so switch to plain white text instead. */}
          {hasImage ? (
            <Header1 className="text-white">
              <bdi>{headline}</bdi>
            </Header1>
          ) : (
            <GradientHeader>
              <Header1>
                <bdi>{headline}</bdi>
              </Header1>
            </GradientHeader>
          )}
          {stewardName || isPublic ? (
            <div
              className={cn(
                'flex flex-wrap items-center justify-center gap-x-2 gap-y-1',
                hasImage ? 'text-white' : 'text-foreground',
              )}
            >
              {stewardName ? (
                <span className="flex items-center gap-1.5">
                  <Avatar className="size-5">
                    {steward?.avatarImage?.name ? (
                      <AvatarImage
                        src={getPublicUrl(steward.avatarImage.name) ?? ''}
                        alt={stewardName}
                        className="object-cover"
                      />
                    ) : null}
                    <AvatarFallback name={stewardName} />
                  </Avatar>
                  <span>
                    {t('Stewarded by')}{' '}
                    {canLinkToSteward ? (
                      // Underline keeps the link distinguishable from
                      // surrounding text without relying on color alone —
                      // axe's `link-in-text-block` flags color-only cues.
                      <Link
                        href={`/profile/${steward.slug}`}
                        className={cn('underline', hasImage && 'text-white')}
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
                <span
                  aria-hidden="true"
                  className={
                    hasImage ? 'text-white/80' : 'text-muted-foreground'
                  }
                >
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
              className={cn(
                'text-base text-balance',
                hasImage ? 'text-white' : 'text-foreground',
              )}
            >
              {subhead}
            </p>
          ) : null}
        </div>
        {showCtas ? (
          <div className="align-stretch flex w-full flex-col gap-4 md:flex-row md:justify-center">
            <ButtonLink
              href={currentPhaseHref}
              variant="outline"
              className="w-auto"
            >
              {t('Browse proposals')}
            </ButtonLink>
            {canSubmitProposal ? (
              <Button
                className="w-auto"
                disabled={!isReady || isCreating}
                onClick={createProposal}
              >
                {isCreating ? <Spinner /> : null}
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
