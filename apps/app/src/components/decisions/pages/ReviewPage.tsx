'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import type { RouterOutput } from '@op/api';
import { type InstancePhaseData } from '@op/api/encoders';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { Suspense } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n/routing';

import { TranslatedText } from '@/components/TranslatedText';

import { DecisionActionBar } from '../DecisionActionBar';
import { DecisionHero } from '../DecisionHero';
import { DecisionHeroBanner } from '../DecisionHeroBanner';
import { useDecisionTranslation } from '../DecisionTranslationContext';
import { ProposalListSkeleton } from '../ProposalListSkeleton';
import { ProposalsList } from '../ProposalsList';
import { ReviewProgressStats } from '../Review/ReviewProgressStats';
import { ReviewAssignmentsList } from '../ReviewAssignmentsList';

type Instance = RouterOutput['decision']['getInstance'];

const REVIEW_TABS = ['to-review', 'other-proposals'] as const;
const DEFAULT_REVIEW_TAB = 'to-review';

// Shared by the URL state and the change handler so the accepted values stay a
// single source of truth; an unknown `?tab=` falls back to the default.
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

  const t = useTranslations();

  // The tab lives in the URL so a reload or a shared link lands on the tab the
  // reviewer was on, and so the per-tab params (`?sort=`) are unambiguous.
  const [tab, setTab] = useQueryState(
    'tab',
    reviewTabParser.withDefault(DEFAULT_REVIEW_TAB),
  );

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
  // Admins get the static "Review Progress" heading; only the reviewer-facing
  // phase copy is author-written, so only it goes through translation.
  const heroHeadline = translation?.headline ?? currentPhase.headline;
  const heroDescription =
    translation?.phaseDescription ?? currentPhase.description;
  const heroImagePath = instance.instanceData?.overview?.heroImage;
  const hasHeroImage = Boolean(heroImagePath);

  const proposalsLoadErrorFallback = {
    default: () => (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LuLeaf className="size-6" />
          </EmptyMedia>
          <EmptyTitle>
            <TranslatedText text="We couldn't load proposals" />
          </EmptyTitle>
          <EmptyDescription>
            <TranslatedText text="Please refresh the page to try again." />
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
              isAdmin ? (
                <TranslatedText text="Review Progress" />
              ) : (
                (heroHeadline ?? <TranslatedText text="Review proposals." />)
              )
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
            <Tabs className="gap-6" value={tab} onValueChange={handleTabChange}>
              <div className="w-full border-b">
                <TabsList variant="line" className="flex gap-6">
                  <TabsTrigger value="to-review">
                    {t('Proposals to review')}
                  </TabsTrigger>
                  <TabsTrigger value="other-proposals">
                    {t('Other proposals')}
                  </TabsTrigger>
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
                </APIErrorBoundary>
              </TabsContent>
            </Tabs>
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
