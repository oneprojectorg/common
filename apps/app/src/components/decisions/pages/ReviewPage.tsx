'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import type { RouterOutput } from '@op/api';
import { type InstancePhaseData } from '@op/api/encoders';
import { EmptyState } from '@op/ui/EmptyState';
import { Header3 } from '@op/ui/Header';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
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
  const heroImagePath = instance.instanceData?.overview?.heroImage;
  const hasHeroImage = Boolean(heroImagePath);

  const proposalsLoadErrorFallback = {
    default: () => (
      <EmptyState icon={<LuLeaf className="size-6" />}>
        <Header3 className="font-serif !text-title-base font-light text-neutral-black">
          <TranslatedText text="We couldn't load proposals" />
        </Header3>
        <p className="text-base text-neutral-charcoal">
          <TranslatedText text="Please refresh the page to try again." />
        </p>
      </EmptyState>
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
                (currentPhase.headline ?? (
                  <TranslatedText text="REVIEW PROPOSALS." />
                ))
              )
            }
            description={
              !isAdmin && currentPhase.description ? (
                <p>{currentPhase.description}</p>
              ) : undefined
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
        <div className="w-full p-4 sm:max-w-6xl sm:p-8">
          {canReview ? (
            <Tabs className="gap-6" defaultSelectedKey="to-review">
              <TabList className="flex gap-6">
                <Tab id="to-review">{t('Proposals to review')}</Tab>
                <Tab id="other-proposals">{t('Other proposals')}</Tab>
              </TabList>

              <TabPanel id="to-review" className="grow sm:p-0">
                <APIErrorBoundary fallbacks={proposalsLoadErrorFallback}>
                  <Suspense fallback={<ProposalListSkeleton />}>
                    <ReviewAssignmentsList
                      processInstanceId={instance.id}
                      decisionSlug={decisionSlug}
                      canViewReviewers={isAdmin}
                    />
                  </Suspense>
                </APIErrorBoundary>
              </TabPanel>

              <TabPanel id="other-proposals" className="grow sm:p-0">
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
              </TabPanel>
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
