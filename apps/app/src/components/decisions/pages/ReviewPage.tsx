'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import type { RouterOutput } from '@op/api';
import { type InstancePhaseData } from '@op/api/encoders';
import { getPhaseReviewSettings } from '@op/common/client';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { Suspense, useMemo } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n/routing';

import { AdminReviewProposalsList } from '../AdminReviewProposalsList';
import { DecisionActionBar } from '../DecisionActionBar';
import { DecisionHero } from '../DecisionHero';
import { DecisionHeroBanner } from '../DecisionHeroBanner';
import { useDecisionTranslation } from '../DecisionTranslationContext';
import { ProposalListSkeleton } from '../ProposalListSkeleton';
import { ProposalsList } from '../ProposalsList';
import { ReviewProgressStats } from '../Review/ReviewProgressStats';
import { ReviewersTableSection } from '../ReviewAssignments/ReviewersTableSection';
import { ReviewAssignmentsList } from '../ReviewAssignmentsList';
import { useRegisterTranslationSamples } from '../TranslationDetectionContext';
import { ProposalReviewDecorationProvider } from '../proposalReviewDecoration';

type Instance = RouterOutput['decision']['getInstance'];

// The admin-without-review variant reuses DEFAULT_REVIEW_TAB for its progress
// list, so one parser covers every `?tab=` value.
const REVIEW_TABS = ['to-review', 'other-proposals', 'assignments'] as const;
const DEFAULT_REVIEW_TAB = 'to-review';

const reviewTabParser = parseAsStringLiteral(REVIEW_TABS);

export function ReviewPage({
  instance,
  decisionSlug,
  slug,
  decisionProfileId,
  pinOffset,
}: {
  instance: Instance;
  decisionSlug: string;
  slug: string;
  decisionProfileId?: string | null;
  /** Sticky filter-bar pin offset, forwarded to ProposalsList. */
  pinOffset?: number;
}) {
  const phases = instance.instanceData?.phases ?? [];
  const currentPhaseId = instance.currentStateId;
  const currentPhase = phases.find(
    (phase): phase is InstancePhaseData => phase.phaseId === currentPhaseId,
  );

  if (!currentPhase) {
    throw new Error(`Phase "${currentPhaseId}" not found in instance phases`);
  }

  const canReview = Boolean(instance.access?.review);
  const isAdmin = Boolean(instance.access?.admin);

  // Instance admins only; the flag fails closed in prod.
  const manualAssignmentsEnabled = useFeatureFlag('manual_review_assignments');
  const showAssignmentsTab = isAdmin && Boolean(manualAssignmentsEnabled);

  // Client-side mirror of the service's `canReadPhaseReviews` gate.
  const canSeeReviewCounts =
    isAdmin ||
    (canReview &&
      getPhaseReviewSettings({ phases }, currentPhase.phaseId).openReviews);

  const t = useTranslations();

  // In the URL so a reload or shared link lands on the same tab.
  const [tab, setTab] = useQueryState(
    'tab',
    reviewTabParser.withDefault(DEFAULT_REVIEW_TAB),
  );

  // A stale `?tab=assignments` (non-admin link, flag off) has no panel.
  const activeTab =
    tab === 'assignments' && !showAssignmentsTab ? DEFAULT_REVIEW_TAB : tab;

  // The admin variant has no 'other-proposals' panel to land on.
  const adminActiveTab =
    activeTab === 'assignments' ? 'assignments' : DEFAULT_REVIEW_TAB;

  const handleTabChange = (next: string) => {
    const parsed = reviewTabParser.parse(next);

    if (!parsed) {
      return;
    }

    // Strip the param on the default tab so the URL stays clean.
    void setTab(parsed === DEFAULT_REVIEW_TAB ? null : parsed);
  };

  const translation = useDecisionTranslation();
  const description =
    instance.description ?? instance.instanceData?.templateDescription;
  const phaseAdditionalInfo =
    translation?.additionalInfo ?? currentPhase.additionalInfo;
  const actionBarDescription =
    phaseAdditionalInfo ?? translation?.description ?? description;
  const actionBarLabel = phaseAdditionalInfo
    ? t('About this phase')
    : undefined;
  // Only the reviewer-facing phase copy is author-written, so only it
  // goes through translation.
  const heroHeadline = translation?.headline ?? currentPhase.headline;
  const heroDescription =
    translation?.phaseDescription ?? currentPhase.description;
  const heroImagePath = instance.instanceData?.overview?.heroImage;
  const hasHeroImage = Boolean(heroImagePath);

  // ProposalsList also samples this copy but can render unmounted here, so
  // register it from the screen that actually shows it.
  const phaseSamples = useMemo(
    () => [currentPhase.headline ?? '', currentPhase.description ?? ''],
    [currentPhase.headline, currentPhase.description],
  );
  useRegisterTranslationSamples('review-phase', phaseSamples);

  const assignmentsTabTrigger = (
    <TabsTrigger value="assignments">{t('Assignments')}</TabsTrigger>
  );

  // Same table as /decisions/[slug]/assignments — the tab and the dedicated
  // screen are two entry points onto one surface, and reviewer rows link into
  // the dedicated per-reviewer route from both.
  const assignmentsTabContent = (
    <TabsContent value="assignments" className="grow sm:p-0">
      <ReviewersTableSection
        decisionSlug={decisionSlug}
        processInstanceId={instance.id}
        phaseId={currentPhase.phaseId}
      />
    </TabsContent>
  );

  const adminProgressList = (
    <AdminReviewProposalsList
      processInstanceId={instance.id}
      slug={slug}
      decisionSlug={decisionSlug}
      decisionProfileId={decisionProfileId}
      access={instance.access}
      currentPhase={currentPhase}
      pinOffset={pinOffset}
    />
  );

  const proposalsLoadErrorFallback = {
    default: () => (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LuLeaf className="size-6" />
          </EmptyMedia>
          <EmptyTitle>{t("We couldn't load proposals")}</EmptyTitle>
          <EmptyDescription>
            {t('Please refresh the page to try again.')}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    ),
  };

  return (
    <div className="min-h-full">
      <DecisionHeroBanner heroImagePath={heroImagePath}>
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-4 px-4 pt-16 pb-8 md:pb-16">
          <DecisionHero
            title={
              isAdmin
                ? t('Review Progress')
                : (heroHeadline ?? t('Review proposals.'))
            }
            description={
              !isAdmin && heroDescription ? <p>{heroDescription}</p> : undefined
            }
            variant="standard"
            hasImage={hasHeroImage}
          >
            {isAdmin ? (
              <ReviewProgressStats
                processInstanceId={instance.id}
                phaseId={currentPhase.phaseId}
                hasImage={hasHeroImage}
              />
            ) : (
              <DecisionActionBar
                instanceId={instance.id}
                description={actionBarDescription}
                label={actionBarLabel}
                markup={!!translation?.additionalInfo}
                showSubmitButton={false}
              />
            )}
          </DecisionHero>
        </div>
      </DecisionHeroBanner>

      <div className="flex w-full justify-center bg-white">
        <div className="w-full p-4 sm:p-8">
          {canReview ? (
            <Tabs
              className="gap-6"
              value={activeTab}
              onValueChange={handleTabChange}
            >
              <div className="w-full border-b">
                <TabsList variant="line" className="flex gap-6">
                  <TabsTrigger value="to-review">
                    {t('Proposals to review')}
                  </TabsTrigger>
                  <TabsTrigger value="other-proposals">
                    {t('Other proposals')}
                  </TabsTrigger>
                  {showAssignmentsTab ? assignmentsTabTrigger : null}
                </TabsList>
              </div>

              <TabsContent value="to-review" className="grow sm:p-0">
                <APIErrorBoundary fallbacks={proposalsLoadErrorFallback}>
                  <Suspense fallback={<ProposalListSkeleton />}>
                    <ReviewAssignmentsList
                      processInstanceId={instance.id}
                      decisionSlug={decisionSlug}
                      decisionProfileId={decisionProfileId}
                      access={instance.access}
                      pinOffset={pinOffset}
                    />
                  </Suspense>
                </APIErrorBoundary>
              </TabsContent>

              <TabsContent value="other-proposals" className="grow sm:p-0">
                <APIErrorBoundary fallbacks={proposalsLoadErrorFallback}>
                  {/* Outside Suspense so the provider's reported proposals
                      survive a re-suspend on filter changes. */}
                  <ProposalReviewDecorationProvider
                    processInstanceId={instance.id}
                    decisionSlug={decisionSlug}
                    phaseId={currentPhase.phaseId}
                    enabled={canSeeReviewCounts}
                    access={instance.access}
                  >
                    <Suspense fallback={<ProposalListSkeleton />}>
                      <ProposalsList
                        slug={slug}
                        instanceId={instance.id}
                        decisionSlug={decisionSlug}
                        decisionProfileId={decisionProfileId}
                        permissions={instance.access}
                        currentPhase={currentPhase}
                        pinOffset={pinOffset}
                        excludeAssignedForReview
                      />
                    </Suspense>
                  </ProposalReviewDecorationProvider>
                </APIErrorBoundary>
              </TabsContent>

              {showAssignmentsTab ? assignmentsTabContent : null}
            </Tabs>
          ) : isAdmin ? (
            // Admin without review capability: the progress list is the whole
            // surface, gaining a sibling tab only when the desk is on.
            showAssignmentsTab ? (
              <Tabs
                className="gap-6"
                value={adminActiveTab}
                onValueChange={handleTabChange}
              >
                <div className="w-full border-b">
                  <TabsList variant="line" className="flex gap-6">
                    <TabsTrigger value={DEFAULT_REVIEW_TAB}>
                      {t('Review progress')}
                    </TabsTrigger>
                    {assignmentsTabTrigger}
                  </TabsList>
                </div>

                <TabsContent value={DEFAULT_REVIEW_TAB} className="grow sm:p-0">
                  {adminProgressList}
                </TabsContent>

                {assignmentsTabContent}
              </Tabs>
            ) : (
              adminProgressList
            )
          ) : (
            <APIErrorBoundary fallbacks={proposalsLoadErrorFallback}>
              <Suspense fallback={<ProposalListSkeleton />}>
                <ProposalsList
                  slug={slug}
                  instanceId={instance.id}
                  decisionSlug={decisionSlug}
                  decisionProfileId={decisionProfileId}
                  permissions={instance.access}
                  currentPhase={currentPhase}
                  pinOffset={pinOffset}
                />
              </Suspense>
            </APIErrorBoundary>
          )}
        </div>
      </div>
    </div>
  );
}
